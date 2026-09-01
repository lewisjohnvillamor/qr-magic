import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ParticleKind } from '../../themes/themes';
import type { RevealValues } from '../../animation/create-reveal-timeline';
import { createRng } from '../../voxel/rng';

export interface ParticlesProps {
  kind: ParticleKind;
  count: number;
  color: string;
  radius: number;
  values: RefObject<RevealValues | null>;
}

const BEHAVIOUR: Record<ParticleKind, { speed: number; size: number; drift: number }> = {
  pollen: { speed: 0.22, size: 0.16, drift: 0.5 },
  grid: { speed: 0.55, size: 0.1, drift: 0.12 },
  shimmer: { speed: 0.34, size: 0.12, drift: 0.3 },
  fog: { speed: 0.12, size: 0.5, drift: 0.7 },
  snow: { speed: 0.45, size: 0.14, drift: 0.4 },
  none: { speed: 0, size: 0, drift: 0 },
};

/**
 * Ambient theme particles. Purely decorative, and the first thing to go: they
 * fade out completely before the QR locks so nothing can occlude a module.
 */
export function Particles({ kind, count, color, radius, values }: ParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const clock = useRef(0);
  const behaviour = BEHAVIOUR[kind];

  const { geometry, seeds } = useMemo(() => {
    const rng = createRng(0x5eed ^ count);
    const positions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (rng() - 0.5) * radius * 2.6;
      positions[i * 3 + 1] = (rng() - 0.5) * radius * 2.2;
      positions[i * 3 + 2] = (rng() - 0.5) * radius * 2.6;
      offsets[i] = rng() * Math.PI * 2;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: buffer, seeds: offsets };
  }, [count, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    const reveal = values.current;
    if (!points || !reveal || count === 0) return;

    const material = points.material as THREE.PointsMaterial;
    const visibility = Math.max(0, 1 - reveal.morph * 1.8) * (1 - reveal.lock);
    material.opacity = visibility * 0.75;
    points.visible = visibility > 0.01;
    if (!points.visible) return;

    clock.current += delta;
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const span = radius * 2.2;

    for (let i = 0; i < count; i += 1) {
      const seed = seeds[i] ?? 0;
      const yIndex = i * 3 + 1;
      const y = (array[yIndex] ?? 0) - behaviour.speed * delta;
      array[yIndex] = y < -span / 2 ? span / 2 : y;
      const xIndex = i * 3;
      array[xIndex] =
        (array[xIndex] ?? 0) + Math.sin(clock.current * 0.6 + seed) * behaviour.drift * delta;
    }
    attribute.needsUpdate = true;
  });

  if (kind === 'none' || count === 0) return null;

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={color}
        size={behaviour.size}
        transparent
        opacity={0.75}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}
