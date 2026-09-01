import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RevealValues } from '../animation/create-reveal-timeline';
import { LOCK_HEIGHT, TILE_HEIGHT } from './build-qr-layout';
import { toSubtle } from '../themes/module-colors';
import { hashString } from './rng';
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
  qrBackground: string;
  /** Per-module mosaic colour; must match the base plane exactly. */
  moduleColor: (row: number, column: number) => string;
  /** True for the three corner finder squares. */
  finder: (row: number, column: number) => boolean;
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
  qrBackground,
  moduleColor,
  finder,
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
  /** Last reveal values written into the instance buffer. While these are
   * unchanged (the whole idle state), the per-instance loop is skipped and
   * animation is carried by the group transform alone — the difference between
   * ~2,000 matrix composes per frame and zero. */
  const written = useRef({ morph: -1, scatter: -1, lock: -1, squash: -1 });

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
  const scratchColor = useMemo(() => new THREE.Color(), []);

  /**
   * Each tile's two lives, precomputed: the whisper pavement colour it rests
   * in while the sculpture is the subject, and the full mosaic colour it
   * reaches at scan time. The frame loop lerps between them by each tile's own
   * progress, matching the base plane's crossfade underneath.
   */
  const tileColors = useMemo(() => {
    const idle: Array<THREE.Color | null> = [];
    const scan: Array<THREE.Color | null> = [];
    for (const instance of layout.instances) {
      if (instance.isQrModule && instance.module) {
        const [row, column] = instance.module;
        const mosaic = moduleColor(row, column);
        // Finder squares rest as tone-on-tone decoration; data tiles rest as
        // pure background — invisible until the reveal surfaces them.
        if (finder(row, column)) {
          // Each finder cube gets its own tone, like stacked stone.
          const jitter = (hashString(`finder:${row}:${column}`) % 1000) / 1000;
          idle.push(new THREE.Color(toSubtle(mosaic, qrBackground, 0.48 + jitter * 0.3)));
        } else {
          idle.push(new THREE.Color(qrBackground));
        }
        scan.push(new THREE.Color(mosaic));
      } else {
        idle.push(null);
        scan.push(null);
      }
    }
    return { idle, scan };
  }, [layout, moduleColor, finder, qrBackground]);

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
        const restsProud = instance.sculpturePosition[1] > LOCK_HEIGHT;
        scratch.scale.set(
          restsProud ? 1 : 0.0001,
          restsProud ? TILE_HEIGHT : 0.0001,
          restsProud ? 1 : 0.0001,
        );
      } else {
        scratch.scale.setScalar(instance.sculptureScale);
      }
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
      const idleTile = tileColors.idle[i];
      if (idleTile) {
        mesh.setColorAt(i, idleTile);
      } else {
        const color = instance.isQrModule
          ? foregroundColor
          : paletteColors[instance.colorIndex % paletteColors.length];
        if (color) mesh.setColorAt(i, color);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, layout, paletteColors, foregroundColor, tileColors, scratch]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    const group = groupRef.current;
    const reveal = values.current;
    if (!mesh || !group || !reveal) return;

    const time = (clockRef.current += delta);
    const { morph, scatter, lock, idle, squash } = reveal;

    flatUniform.current.value = lock;

    const last = written.current;
    const dirty =
      last.morph !== morph ||
      last.scatter !== scatter ||
      last.lock !== lock ||
      last.squash !== squash;

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

    if (!dirty) return;
    last.morph = morph;
    last.scatter = scatter;
    last.lock = lock;
    last.squash = squash;

    for (let i = 0; i < count; i += 1) {
      const instance = layout.instances[i];
      if (!instance) continue;

      const start = instance.delay * STAGGER_WINDOW;
      const raw = (morph - start) / (1 - start);
      const local = smoothstep(Math.min(1, Math.max(0, raw)));

      const [sx, sy, sz] = instance.sculpturePosition;
      const [qx, qy, qz] = instance.qrPosition;

      if (instance.isQrModule) {
        // Tiles surface: data tiles do not exist at rest — even flush,
        // background-coloured lit geometry shades differently from the unlit
        // ground and ghosts the pattern. Each one grows in as the reveal
        // reaches it, swells upward — the code rising out of the ground —
        // then settles flush, coloured in, for the scan. The finder squares
        // (which rest proud as decoration) are always fully grown.
        const restsProud = sy > LOCK_HEIGHT;
        const grown = restsProud ? 1 : Math.min(1, local * 4);
        const swell = Math.sin(local * Math.PI) * (TILE_HEIGHT / 2) * (1 - lock);
        const y = sy + (qy - sy) * local + swell;
        scratch.position.set(sx, y, sz);
        scratch.quaternion.identity();
        scratch.scale.set(grown, Math.max(y * 2, 0.0001) * grown, grown);
        const idleColor = tileColors.idle[i];
        const scanColor = tileColors.scan[i];
        if (idleColor && scanColor) {
          scratchColor.copy(idleColor).lerp(scanColor, local);
          mesh.setColorAt(i, scratchColor);
        }
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
