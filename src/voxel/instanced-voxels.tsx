import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RevealValues } from '../animation/create-reveal-timeline';
import { TILE_HEIGHT } from './build-qr-layout';
import type { VoxelLayout } from './types';

/**
 * Fraction of the morph devoted to spreading arrival times. Kept below 1 so
 * that every cube reaches its exact pose when `morph` reaches 1 — the lock
 * state must be mathematically exact, not merely close.
 */
const STAGGER_WINDOW = 0.34;

const HALF_PI = Math.PI / 2;

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
 * Every cube in a single `InstancedMesh` — the QR tiles of the base plinth and
 * the sculpture standing on it, one draw call for both.
 *
 * Nothing is allocated inside the frame loop: matrices, vectors, quaternions
 * and colours are created once and reused.
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
  /** Accumulated idle spin; settles onto the nearest right angle at reveal. */
  const yawRef = useRef(0);

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
     * At the lock stage the shaded result is replaced by the raw instance
     * colour. Lighting, fog and shadows are beautiful and are also the enemy
     * of a scanner: this guarantees the final modules are exactly the
     * foreground colour, whatever the theme's lighting is doing.
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
    }),
    [],
  );

  const paletteColors = useMemo(() => palette.map((hex) => new THREE.Color(hex)), [palette]);
  const foregroundColor = useMemo(() => new THREE.Color(qrForeground), [qrForeground]);

  // Seed matrices and colours synchronously so the first painted frame is the
  // finished plinth-and-sculpture rather than a pile of cubes at the origin.
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
      if (instance.isQrModule) {
        scratch.scale.set(1, TILE_HEIGHT, 1);
      } else {
        scratch.scale.setScalar(instance.sculptureScale);
      }
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
      const color = instance.isQrModule
        ? foregroundColor
        : paletteColors[instance.colorIndex % paletteColors.length];
      if (color) mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, layout, paletteColors, foregroundColor, scratch]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    const group = groupRef.current;
    const reveal = values.current;
    if (!mesh || !group || !reveal) return;

    const time = (clockRef.current += delta);
    const { morph, scatter, lock, idle, squash } = reveal;

    flatUniform.current.value = lock;

    // The whole plinth turns slowly while idle. Spin accumulates only while
    // idle, and settles onto the nearest right angle for the scan state — a
    // right-angle rotation still decodes, an oblique one costs sharpness.
    yawRef.current += delta * 0.16 * idle;
    const nearestRightAngle = Math.round(yawRef.current / HALF_PI) * HALF_PI;
    const yaw = yawRef.current * idle + nearestRightAngle * (1 - idle);
    const pointerYaw = (pointer.current?.x ?? 0) * 0.22 * idle;
    const pointerPitch = (pointer.current?.y ?? 0) * -0.06 * idle;
    group.rotation.set(pointerPitch, yaw + pointerYaw, 0);
    group.position.y = idle * Math.sin(time * 0.7) * 0.18;

    for (let i = 0; i < count; i += 1) {
      const instance = layout.instances[i];
      if (!instance) continue;

      const start = instance.delay * STAGGER_WINDOW;
      const raw = (morph - start) / (1 - start);
      const local = smoothstep(Math.min(1, Math.max(0, raw)));

      const [sx, sy, sz] = instance.sculpturePosition;
      const [qx, qy, qz] = instance.qrPosition;

      if (instance.isQrModule) {
        // Tiles only settle: same footprint, height eases from plinth to flush.
        const y = sy + (qy - sy) * local;
        scratch.position.set(sx, y, sz);
        scratch.quaternion.identity();
        scratch.scale.set(1, y * 2, 1);
      } else {
        // Sculpture cubes lift with the scatter, then dive into the base and
        // are absorbed by the module they land on.
        const wobble = Math.sin(local * Math.PI) * (1 - lock);
        scratch.position.set(
          sx + (qx - sx) * local + instance.scatter[0] * scatter * wobble,
          sy + (qy - sy) * local + instance.scatter[1] * Math.max(scatter, wobble * 0.6),
          sz + (qz - sz) * local + instance.scatter[2] * scatter * wobble,
        );
        // Anticipation squash compresses the sculpture toward the plinth.
        scratch.position.y = TILE_HEIGHT + (scratch.position.y - TILE_HEIGHT) * squash;

        const [rx, ry, rz] = instance.sculptureRotation;
        const spin = 1 - local;
        scratch.euler.set(
          rx * spin + local * Math.PI * 0.5 * instance.scatter[0] * 0.1,
          ry * spin,
          rz * spin,
        );
        scratch.quaternion.setFromEuler(scratch.euler);

        const shrink = 1 - local * local;
        scratch.scale.setScalar(Math.max(0.0001, instance.sculptureScale * shrink));
      }

      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
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
