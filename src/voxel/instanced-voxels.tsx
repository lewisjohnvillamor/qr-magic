import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RevealValues } from '../animation/create-reveal-timeline';
import type { VoxelLayout } from './types';

/**
 * Fraction of the morph devoted to spreading cube arrival times. Kept below 1 so
 * that every cube reaches its exact QR pose when `morph` reaches 1 — the lock
 * state must be mathematically exact, not merely close.
 */
const STAGGER_WINDOW = 0.34;

export interface InstancedVoxelsProps {
  layout: VoxelLayout;
  palette: readonly string[];
  qrForeground: string;
  values: RefObject<RevealValues | null>;
  /** Pointer influence in normalized device coordinates, -1..1. */
  pointer: RefObject<{ x: number; y: number }>;
  castShadow: boolean;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Every visible cube in a single `InstancedMesh` — one draw call for the whole
 * sculpture and the whole QR code.
 *
 * Nothing is allocated inside the frame loop: matrices, vectors, quaternions and
 * colours are created once and reused.
 */
export function InstancedVoxels({
  layout,
  palette,
  qrForeground,
  values,
  pointer,
  castShadow,
}: InstancedVoxelsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const flatUniform = useRef({ value: 0 });
  const clockRef = useRef(0);

  const count = layout.instances.length;

  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    // `vertexColors` needs a colour attribute to multiply into; ones keep the
    // per-instance colour authoritative.
    const vertexCount = box.attributes.position?.count ?? 0;
    const colors = new Float32Array(vertexCount * 3).fill(1);
    box.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return box;
  }, []);

  const material = useMemo(() => {
    const standard = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.08,
      transparent: false,
    });

    /**
     * At the lock stage the shaded result is replaced by the raw instance colour.
     * Lighting, fog and shadows are beautiful and are also the enemy of a
     * scanner: this guarantees the final modules are exactly the foreground
     * colour, whatever the theme's lighting is doing.
     */
    standard.onBeforeCompile = (shader) => {
      shader.uniforms.uFlat = flatUniform.current;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uFlat;\nvoid main() {')
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           gl_FragColor.rgb = mix( gl_FragColor.rgb, linearToOutputTexel( vec4( vColor.rgb, 1.0 ) ).rgb, uFlat );`,
        );
    };
    standard.customProgramCacheKey = () => 'voxelqr-flat-lock';
    return standard;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Scratch objects, allocated once.
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
      base: new THREE.Color(),
      target: new THREE.Color(),
    }),
    [],
  );

  const paletteColors = useMemo(() => palette.map((hex) => new THREE.Color(hex)), [palette]);
  const foregroundColor = useMemo(() => new THREE.Color(qrForeground), [qrForeground]);

  // Seed the instance matrices synchronously so the very first painted frame is
  // already the sculpture rather than a pile of cubes at the origin.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.count = count;
    for (let i = 0; i < count; i += 1) {
      const instance = layout.instances[i];
      if (!instance) continue;
      scratch.position.set(...instance.sculpturePosition);
      scratch.euler.set(...instance.sculptureRotation);
      scratch.quaternion.setFromEuler(scratch.euler);
      scratch.scale.setScalar(instance.sculptureScale);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
      const base = paletteColors[instance.colorIndex % paletteColors.length];
      if (base) mesh.setColorAt(i, base);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, layout, paletteColors, scratch]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    const group = groupRef.current;
    const reveal = values.current;
    if (!mesh || !group || !reveal) return;

    const time = (clockRef.current += delta);
    const { morph, scatter, lock, idle, squash } = reveal;

    flatUniform.current.value = lock;

    // Idle motion and pointer influence live on the parent group, so they reach
    // exactly zero the moment the lock completes.
    const targetYaw = idle * (time * 0.18 + (pointer.current?.x ?? 0) * 0.35);
    const targetPitch = idle * ((pointer.current?.y ?? 0) * -0.2 + Math.sin(time * 0.5) * 0.03);
    group.rotation.set(targetPitch, targetYaw, 0);
    group.position.y = idle * Math.sin(time * 0.7) * 0.25;
    group.scale.set(1, squash, 1);

    for (let i = 0; i < count; i += 1) {
      const instance = layout.instances[i];
      if (!instance) continue;

      const start = instance.delay * STAGGER_WINDOW;
      const raw = (morph - start) / (1 - start);
      const local = smoothstep(Math.min(1, Math.max(0, raw)));

      const [sx, sy, sz] = instance.sculpturePosition;
      const [qx, qy, qz] = instance.qrPosition;

      // Cubes lift out of the scene and arc onto the grid rather than sliding.
      const arc = Math.sin(local * Math.PI) * (instance.isQrModule ? 1.6 : 3.2) * (1 - lock);
      const wobble = scatter * (1 - lock);

      scratch.position.set(
        sx + (qx - sx) * local + instance.scatter[0] * wobble,
        sy + (qy - sy) * local + instance.scatter[1] * wobble,
        sz + (qz - sz) * local + instance.scatter[2] * wobble + arc,
      );

      const [rx, ry, rz] = instance.sculptureRotation;
      const spin = (1 - lock) * (1 - local);
      scratch.euler.set(
        rx * spin + wobble * instance.scatter[0] * 0.25,
        ry * spin + wobble * instance.scatter[1] * 0.25,
        rz * spin,
      );
      scratch.quaternion.setFromEuler(scratch.euler);

      const scaleValue = Math.max(
        0,
        instance.sculptureScale + (instance.qrScale - instance.sculptureScale) * local,
      );
      /**
       * Cubes flatten into tiles as they arrive.
       *
       * Under a perspective camera an off-axis cube shows one of its side faces,
       * which widens that module by a fraction of its own depth. On a dense code
       * that error accumulates until adjacent modules merge and the code stops
       * decoding — so by the time a voxel reaches the grid it has no depth left
       * to show.
       */
      scratch.scale.set(scaleValue, scaleValue, scaleValue * (1 - local * 0.98));

      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);

      if (instance.isQrModule) {
        const base = paletteColors[instance.colorIndex % paletteColors.length];
        if (base) {
          scratch.color.copy(base).lerp(foregroundColor, local * local);
          mesh.setColorAt(i, scratch.color);
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, Math.max(count, 1)]}
        castShadow={castShadow}
        receiveShadow={castShadow}
        frustumCulled={false}
      />
    </group>
  );
}
