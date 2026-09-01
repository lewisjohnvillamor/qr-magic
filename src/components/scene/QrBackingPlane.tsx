import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { QrMatrix } from '../../qr/generate-matrix';
import { drawCanonicalQr } from '../../qr/draw-canonical';

export interface QrBasePlaneProps {
  matrix: QrMatrix;
  foreground: string;
  background: string;
  /** Per-module mosaic colour; must match the tiles exactly. */
  moduleColor: (row: number, column: number) => string;
}

/**
 * The base the sculpture stands on — and the scan-safe layer (spec §9.3).
 *
 * A single plane lying in the ground carries the mathematically exact QR,
 * quiet zone included, from the very first frame: the finder squares are part
 * of the scenery, not something the reveal conjures. The raised tiles above it
 * add the 3D relief; when they settle flush at lock, any sub-pixel seam
 * between tiles falls on this plane's correct pixels, so the scanning state is
 * exact however the tiles anti-alias.
 */
export function QrBasePlane({ matrix, foreground, background, moduleColor }: QrBasePlaneProps) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    // 12 device pixels per module keeps the texture crisp at any sensible
    // on-screen size while staying well inside texture limits.
    drawCanonicalQr(context, matrix, { foreground, background, moduleColor, modulePixels: 12 });
    const created = new THREE.CanvasTexture(canvas);
    created.magFilter = THREE.NearestFilter;
    created.minFilter = THREE.NearestFilter;
    created.generateMipmaps = false;
    created.colorSpace = THREE.SRGBColorSpace;
    created.anisotropy = 1;
    return created;
  }, [matrix, foreground, background, moduleColor]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} renderOrder={-1}>
      <planeGeometry args={[matrix.total, matrix.total]} />
      <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
    </mesh>
  );
}
