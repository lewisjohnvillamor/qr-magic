import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { QrMatrix } from '../../qr/generate-matrix';
import type { SculptureId } from '../../voxel/types';
import type { Theme } from '../../themes/themes';
import type { QualityProfile } from '../../lib/quality';
import type { RevealValues } from '../../animation/create-reveal-timeline';
import { buildQrLayout } from '../../voxel/build-qr-layout';
import { hashString } from '../../voxel/rng';
import { buildModuleRamp, moduleColorAt } from '../../themes/module-colors';
import { isProtectedModule } from '../../qr/generate-matrix';
import { InstancedVoxels } from '../../voxel/instanced-voxels';
import { QrBasePlane } from './QrBackingPlane';
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
  /** Constant inset the scan pose frames against (see `CameraRig`). */
  scanInset: number;
  /** Pauses rendering entirely when the document is hidden. */
  active: boolean;
}

/**
 * Atmosphere, tied to the viewing distance.
 *
 * Fog distances follow the camera rather than sitting at fixed world-space
 * depths. The camera travels a long way up to frame the code, and a fixed fog
 * range that flatters the sculpture would bury the base in haze precisely
 * during the reveal — the one moment the scene has to read.
 */
function SceneAtmosphere({ theme }: { theme: Theme }) {
  const { scene, camera } = useThree();

  useEffect(() => {
    const fog = new THREE.Fog(theme.fog.color, 1, 2);
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, theme]);

  useFrame(() => {
    const fog = scene.fog;
    if (!(fog instanceof THREE.Fog)) return;
    const distance = camera.position.length();
    fog.near = distance * theme.fog.near;
    fog.far = distance * theme.fog.far;
  });

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
  scanInset,
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

  /** Highest point of the sculpture standing on the base. */
  const sculptureTop = useMemo(() => {
    let top = 1;
    for (const instance of layout.instances) {
      if (instance.isQrModule) continue;
      top = Math.max(top, instance.sculpturePosition[1]);
    }
    return top;
  }, [layout]);

  const lightRadius = Math.max(layout.qrWorldSize / 2, sculptureTop);

  /** The mosaic: deterministic per-module theme colours, contrast-floored, and
   * identical between the base plane and the raised tiles. */
  const moduleColor = useMemo(() => {
    const ramp = buildModuleRamp(theme, qrBackground);
    const seed = hashString(`${matrix.value}:${theme.id}`);
    return (row: number, column: number) =>
      moduleColorAt(ramp, seed, row, column, isProtectedModule(matrix, row, column));
  }, [theme, qrBackground, matrix]);

  return (
    <>
      <SceneAtmosphere theme={theme} />
      <CameraRig
        qrWorldSize={layout.qrWorldSize}
        sculptureTop={sculptureTop}
        bottomInset={bottomInset}
        scanInset={scanInset}
        values={values}
        pointer={pointer}
      />

      <ambientLight color={theme.lights.ambient} intensity={0.62} />
      {/* Lights are placed relative to the scene: a fixed position that
          flatters a small base sits inside a large one. */}
      <directionalLight
        color={theme.lights.key}
        intensity={1.85}
        position={[lightRadius * 0.6, lightRadius * 1.4, lightRadius * 0.9]}
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
        position={[-lightRadius, lightRadius * 0.4, -lightRadius * 0.8]}
      />

      {/* The code is the ground: base plane first, tiles and sculpture above. */}
      <QrBasePlane
        matrix={matrix}
        foreground={qrForeground}
        background={qrBackground}
        moduleColor={moduleColor}
        values={values}
      />

      <InstancedVoxels
        layout={layout}
        palette={theme.voxels}
        qrForeground={qrForeground}
        qrBackground={qrBackground}
        moduleColor={moduleColor}
        values={values}
        pointer={pointer}
        castShadow={quality.shadows}
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
  const [onScreen, setOnScreen] = useState(true);

  // An embed scrolled out of view must not keep rendering: pause the loop
  // whenever less than a sliver of the canvas is visible.
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOnScreen(entry.isIntersecting);
      },
      { threshold: 0.02 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
    // Tracked on the window rather than the canvas: the reveal control sits on
    // top of the scene, and a listener on the canvas would stop receiving
    // moves the moment the pointer crossed it.
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerleave', handleLeave);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="scene" data-testid="voxel-scene">
      <Canvas
        frameloop={props.active && onScreen ? 'always' : 'never'}
        dpr={[1, props.quality.maxDpr]}
        shadows={props.quality.shadows}
        camera={{ fov: 40, position: [18, 22, 32] }}
        gl={{
          antialias: props.quality.antialias,
          alpha: true,
          powerPreference: 'high-performance',
          // The e2e decode suite screenshots the live canvas, which requires
          // the drawing buffer to still hold the last frame.
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
