import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { QrMatrix } from '../../qr/generate-matrix';
import { drawCanonicalQr } from '../../qr/draw-canonical';
import type { RevealValues } from '../../animation/create-reveal-timeline';

export interface QrBasePlaneProps {
  matrix: QrMatrix;
  foreground: string;
  background: string;
  /** Per-module mosaic colour; must match the tiles exactly. */
  moduleColor: (row: number, column: number) => string;
  values: RefObject<RevealValues | null>;
}

/**
 * The ground the code resolves onto — and the scan-safe layer (spec §9.3).
 *
 * It carries the mathematically exact mosaic, quiet zone included, so that at
 * lock any sub-pixel seam between raised tiles falls on a correct pixel. At
 * rest it is fully transparent: there is no platform under the sculpture, only
 * the three finder monuments, and the code materialises as the reveal runs.
 *
 * Opacity trails the tiles slightly, so the code reads as growing out of the
 * ground rather than being switched on underneath them.
 */
export function QrBasePlane({
  matrix,
  foreground,
  background,
  moduleColor,
  values,
}: QrBasePlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

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

  useFrame(() => {
    const mesh = meshRef.current;
    const reveal = values.current;
    if (!mesh || !reveal) return;
    const material = mesh.material as THREE.MeshBasicMaterial;
    /**
     * The plane arrives late, once the tiles are essentially full size.
     *
     * Fading it in while tiles were still growing put a half-opacity full-size
     * module under a half-grown raised one — the same pattern at two sizes,
     * which reads as every module being doubled and offset. Waiting until the
     * tiles have arrived means the two are congruent by the time both are
     * visible, and the tiles then shrink away to leave the plane alone.
     */
    const opacity = Math.min(1, Math.max(0, (reveal.morph - 0.62) / 0.3));
    material.opacity = opacity;
    // Opaque at the scan state: no blending between the code and whatever is
    // behind it, so the rendered colours are exactly the canonical ones.
    material.transparent = opacity < 1;
    mesh.visible = opacity > 0.001;
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.005, 0]}
      visible={false}
      renderOrder={-1}
    >
      <planeGeometry args={[matrix.total, matrix.total]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        fog={false}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}
