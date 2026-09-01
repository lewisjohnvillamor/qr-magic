import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { QrMatrix } from '../../qr/generate-matrix';
import type { SculptureId } from '../../voxel/types';
import type { Theme } from '../../themes/themes';
import type { QualityProfile } from '../../lib/quality';
import type { RevealValues } from '../../animation/create-reveal-timeline';
import { buildQrLayout } from '../../voxel/build-qr-layout';
import { hashString } from '../../voxel/rng';
import { InstancedVoxels } from '../../voxel/instanced-voxels';
import { QrBackingPlane } from './QrBackingPlane';
import { CameraRig } from './CameraRig';
import { Particles } from './Particles';

export interface VoxelSceneProps {
  matrix: QrMatrix;
  sculpture: SculptureId;
  theme: Theme;
  quality: QualityProfile;
  qrForeground: string;
  qrBackground: string;
  values: RefObject<RevealValues | null>;
  /** Pixels of the viewport covered by the control panel. */
  bottomInset: number;
  /** Pauses rendering entirely when the document is hidden. */
  active: boolean;
}

/**
 * Atmosphere, scaled to the subject.
 *
 * Fog distances are derived from the sculpture's own size rather than fixed in
 * world units: a fixed near plane that flatters a small sculpture will bury a
 * large one in haze.
 */
function SceneAtmosphere({ theme, radius }: { theme: Theme; radius: number }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog(theme.fog.color, radius * theme.fog.near, radius * theme.fog.far);
    return () => {
      scene.fog = null;
    };
  }, [scene, theme, radius]);
  return null;
}

function SceneContents({
  matrix,
  sculpture,
  theme,
  quality,
  qrForeground,
  qrBackground,
  bottomInset,
  values,
  pointer,
}: VoxelSceneProps & { pointer: RefObject<{ x: number; y: number }> }) {
  const layout = useMemo(
    () =>
      buildQrLayout({
        matrix,
        sculpture,
        sculptureCount: quality.sculptureCount,
        seed: hashString(`${matrix.value}:${sculpture}`),
      }),
    [matrix, sculpture, quality.sculptureCount],
  );

  /** Separate horizontal and vertical extents: a city is wide and flat, a
   * crystal is tall and narrow, and one radius flatters neither. */
  const extent = useMemo(() => {
    let radiusXZ = 1;
    let halfHeight = 1;
    for (const instance of layout.instances) {
      if (!instance.isQrModule && instance.sculptureScale === 0) continue;
      const [x, y, z] = instance.sculpturePosition;
      radiusXZ = Math.max(radiusXZ, Math.hypot(x, z));
      halfHeight = Math.max(halfHeight, Math.abs(y));
    }
    return { radiusXZ, halfHeight };
  }, [layout]);

  const lightRadius = Math.max(extent.radiusXZ, extent.halfHeight);

  return (
    <>
      <SceneAtmosphere theme={theme} radius={lightRadius} />
      <CameraRig
        qrWorldSize={layout.qrWorldSize}
        extent={extent}
        bottomInset={bottomInset}
        values={values}
        pointer={pointer}
      />

      <ambientLight color={theme.lights.ambient} intensity={0.62} />
      {/* Lights are placed relative to the sculpture: a fixed position that
          flatters a small crystal sits inside a large city. */}
      <directionalLight
        color={theme.lights.key}
        intensity={1.85}
        position={[lightRadius * 0.6, lightRadius * 1.3, lightRadius * 0.9]}
        castShadow={quality.shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.002}
        shadow-normalBias={0.06}
        shadow-camera-near={1}
        shadow-camera-far={lightRadius * 6}
        shadow-camera-left={-lightRadius * 1.6}
        shadow-camera-right={lightRadius * 1.6}
        shadow-camera-top={lightRadius * 1.6}
        shadow-camera-bottom={-lightRadius * 1.6}
      />
      <directionalLight
        color={theme.lights.rim}
        intensity={0.65}
        position={[-lightRadius, -lightRadius * 0.35, -lightRadius * 0.8]}
      />

      <InstancedVoxels
        layout={layout}
        palette={theme.voxels}
        qrForeground={qrForeground}
        values={values}
        pointer={pointer}
        castShadow={quality.shadows}
      />

      <QrBackingPlane
        matrix={matrix}
        foreground={qrForeground}
        background={qrBackground}
        values={values}
      />

      <Particles
        kind={theme.particles}
        count={quality.particles}
        color={theme.lights.rim}
        radius={Math.max(lightRadius, 8)}
        values={values}
      />
    </>
  );
}

/**
 * The WebGL host.
 *
 * Rendering is driven on demand: the frame loop stops entirely when the tab is
 * hidden, and the device pixel ratio is capped by the active quality tier.
 */
export function VoxelScene(props: VoxelSceneProps) {
  const pointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const handleLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    element.addEventListener('pointermove', handleMove, { passive: true });
    element.addEventListener('pointerleave', handleLeave);
    return () => {
      element.removeEventListener('pointermove', handleMove);
      element.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="scene" data-testid="voxel-scene">
      <Canvas
        frameloop={props.active ? 'always' : 'never'}
        dpr={[1, props.quality.maxDpr]}
        shadows={props.quality.shadows}
        camera={{ fov: 42, position: [0, 4, 30] }}
        gl={{
          antialias: props.quality.antialias,
          alpha: true,
          powerPreference: 'high-performance',
          // The e2e decode suite screenshots the live canvas, which requires the
          // drawing buffer to still hold the last frame.
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <SceneContents {...props} pointer={pointer} />
      </Canvas>
    </div>
  );
}
