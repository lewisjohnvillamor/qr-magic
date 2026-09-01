import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { QrMatrix } from '../../qr/generate-matrix';
import { drawCanonicalQr } from '../../qr/draw-canonical';
import { toSubtle } from '../../themes/module-colors';
import type { RevealValues } from '../../animation/create-reveal-timeline';

export interface QrBasePlaneProps {
  matrix: QrMatrix;
  foreground: string;
  background: string;
  /** Per-module mosaic colour; must match the tiles exactly. */
  moduleColor: (row: number, column: number) => string;
  /** True for the three corner finder squares. */
  finder: (row: number, column: number) => boolean;
  values: RefObject<RevealValues | null>;
}

function makeTexture(
  draw: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  draw(context);
  const created = new THREE.CanvasTexture(canvas);
  created.magFilter = THREE.NearestFilter;
  created.minFilter = THREE.NearestFilter;
  created.generateMipmaps = false;
  created.colorSpace = THREE.SRGBColorSpace;
  created.anisotropy = 1;
  return created;
}

/**
 * The base the sculpture stands on — and the scan-safe layer (spec §9.3).
 *
 * Two truths share one square of ground. Underneath, always present, lies the
 * mathematically exact mosaic QR (quiet zone included). Over it floats the
 * resting cover: a plain themed ground carrying only the three finder squares
 * as tone-on-tone decoration. The cover fades out as the reveal runs, so the
 * idle state gives nothing of the data away and the scan state is exactly the
 * canonical code with no blending in the way.
 */
export function QrBasePlane({
  matrix,
  foreground,
  background,
  moduleColor,
  finder,
  values,
}: QrBasePlaneProps) {
  const subtleRef = useRef<THREE.Mesh>(null);

  const mosaicTexture = useMemo(
    () =>
      makeTexture((context) =>
        drawCanonicalQr(context, matrix, { foreground, background, moduleColor, modulePixels: 12 }),
      ),
    [matrix, foreground, background, moduleColor],
  );

  const subtleTexture = useMemo(
    () =>
      makeTexture((context) =>
        drawCanonicalQr(context, matrix, {
          foreground,
          background,
          // Only the three finder squares survive as tone-on-tone decoration;
          // data modules are painted straight background, so nothing of the
          // code is on display until the reveal surfaces it.
          moduleColor: (row, column) =>
            finder(row, column) ? toSubtle(moduleColor(row, column), background, 0.7) : background,
          modulePixels: 12,
        }),
      ),
    [matrix, foreground, background, moduleColor, finder],
  );

  useEffect(() => () => mosaicTexture?.dispose(), [mosaicTexture]);
  useEffect(() => () => subtleTexture?.dispose(), [subtleTexture]);

  useFrame(() => {
    const subtle = subtleRef.current;
    const reveal = values.current;
    if (!subtle || !reveal) return;
    const material = subtle.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, 1 - reveal.morph * 1.25);
    // Fully removed at scan time so nothing can blend over the canonical code.
    subtle.visible = material.opacity > 0.01;
  });

  if (!mosaicTexture || !subtleTexture) return null;

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} renderOrder={-2}>
        <planeGeometry args={[matrix.total, matrix.total]} />
        <meshBasicMaterial map={mosaicTexture} toneMapped={false} fog={false} />
      </mesh>
      <mesh
        ref={subtleRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.004, 0]}
        renderOrder={-1}
      >
        <planeGeometry args={[matrix.total, matrix.total]} />
        <meshBasicMaterial
          map={subtleTexture}
          toneMapped={false}
          fog={false}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
