import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RevealValues } from '../../animation/create-reveal-timeline';
import type { Weather } from '../../lib/weather';
import { createRng } from '../../voxel/rng';

export interface PrecipitationProps {
  weather: Weather | null;
  /** Particle budget from the quality tier; 0 disables the layer entirely. */
  count: number;
  radius: number;
  values: RefObject<RevealValues | null>;
}

/**
 * Rain falls fast in near-straight lines; snow is slow and wanders. Storm is
 * rain with more of it, harder, and leant further over by the wind.
 */
const FALL = {
  rain: { speed: 16, streak: 1.3, drift: 0.15, size: 0.05, opacity: 0.5, density: 4 },
  storm: { speed: 26, streak: 2.0, drift: 0.2, size: 0.05, opacity: 0.6, density: 6 },
  snow: { speed: 1.8, streak: 0, drift: 1.1, size: 0.42, opacity: 1, density: 4 },
} as const;

type FallKind = keyof typeof FALL;

function fallKind(weather: Weather | null): FallKind | null {
  if (!weather || weather.precipitation <= 0) return null;
  if (weather.condition === 'snow') return 'snow';
  if (weather.condition === 'storm') return 'storm';
  if (weather.condition === 'rain') return 'rain';
  return null;
}

/**
 * Real weather, falling on the sculpture.
 *
 * Like the theme particles, this is the first thing to go: it fades out well
 * before the code locks, because a raindrop drawn over a module is a module a
 * camera can misread. Everything the scene adds for atmosphere is subordinate
 * to the code still scanning.
 */
export function Precipitation({ weather, count, radius, values }: PrecipitationProps) {
  const groupRef = useRef<THREE.Object3D>(null);
  const clock = useRef(0);
  const kind = fallKind(weather);

  // The volume drops fall through. Kept close around the sculpture rather than
  // filling the whole visible world: spread thin over a large box, any
  // affordable number of drops reads as a few specks instead of weather.
  const span = Math.max(radius, 6) * 1.3;
  const height = span * 1.4;

  // Heavier weather means more of it, but the quality tier still sets the
  // ceiling — a low-end device does not get a storm's worth of geometry.
  const drops = useMemo(() => {
    if (!kind) return 0;
    const behaviour = FALL[kind];
    const share = behaviour.density * (0.55 + 0.45 * (weather?.precipitation ?? 0));
    return Math.max(0, Math.round(count * share));
  }, [kind, count, weather?.precipitation]);

  const { geometry, seeds } = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    if (drops === 0 || !kind) return { geometry: buffer, seeds: new Float32Array(0) };

    const streak = FALL[kind].streak;
    // Rain is drawn as segments so a drop reads as a streak rather than a dot;
    // snow is drawn as points, so its "segment" has zero length.
    const vertices = streak > 0 ? drops * 2 : drops;
    const positions = new Float32Array(vertices * 3);
    const offsets = new Float32Array(drops);
    const rng = createRng(0xfa11 ^ drops);

    for (let i = 0; i < drops; i += 1) {
      const x = (rng() - 0.5) * span;
      const y = (rng() - 0.5) * height;
      const z = (rng() - 0.5) * span;
      offsets[i] = rng() * Math.PI * 2;
      if (streak > 0) {
        const head = i * 6;
        positions[head] = x;
        positions[head + 1] = y;
        positions[head + 2] = z;
        positions[head + 3] = x;
        positions[head + 4] = y + streak;
        positions[head + 5] = z;
      } else {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
    }
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: buffer, seeds: offsets };
  }, [drops, kind, span, height]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_state, delta) => {
    const object = groupRef.current;
    const reveal = values.current;
    if (!object || !reveal || !kind || drops === 0) return;

    // The same fade the theme particles use: gone before the code locks.
    const visibility = Math.max(0, 1 - reveal.morph * 1.8) * (1 - reveal.lock);
    const material = object as unknown as { material: THREE.Material & { opacity: number } };
    material.material.opacity = visibility * FALL[kind].opacity;
    object.visible = visibility > 0.01;
    if (!object.visible) return;

    // Wind leans the whole volume rather than tilting each drop: one rotation
    // instead of thousands of vector rotations every frame.
    const lean = (weather?.wind ?? 0) * 0.5;
    object.rotation.z = kind === 'snow' ? lean * 0.4 : lean;

    clock.current += delta;
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const behaviour = FALL[kind];
    const speed = behaviour.speed * (0.6 + 0.4 * (weather?.precipitation ?? 1));
    const stride = behaviour.streak > 0 ? 6 : 3;
    const step = speed * delta;
    const floor = -height / 2;

    for (let i = 0; i < drops; i += 1) {
      const base = i * stride;
      let y = (array[base + 1] ?? 0) - step;
      // Snow wanders sideways on its way down; rain barely does.
      const sway = Math.sin(clock.current * 0.8 + (seeds[i] ?? 0)) * behaviour.drift * delta;

      if (y < floor) {
        y += height;
        array[base + 2] = (Math.random() - 0.5) * span;
      }
      array[base] = (array[base] ?? 0) + sway;
      array[base + 1] = y;
      if (behaviour.streak > 0) {
        array[base + 3] = array[base] ?? 0;
        array[base + 4] = y + behaviour.streak;
        array[base + 5] = array[base + 2] ?? 0;
      }
    }
    attribute.needsUpdate = true;
  });

  if (!kind || drops === 0) return null;

  // Snow is bright and soft; rain is a pale cool grey that reads against every
  // theme without becoming a colour of its own.
  const color = kind === 'snow' ? '#f4f8ff' : '#b9cfe4';

  if (kind === 'snow') {
    return (
      <points ref={groupRef as RefObject<THREE.Points>} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          color={color}
          size={FALL.snow.size}
          transparent
          opacity={FALL.snow.opacity}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    );
  }

  return (
    <lineSegments
      ref={groupRef as RefObject<THREE.LineSegments>}
      geometry={geometry}
      frustumCulled={false}
    >
      <lineBasicMaterial
        color={color}
        transparent
        opacity={FALL[kind].opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
