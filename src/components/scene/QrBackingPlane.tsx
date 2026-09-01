import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { QrMatrix } from '../../qr/generate-matrix';
import { drawCanonicalQr } from '../../qr/draw-canonical';
import type { RevealValues } from '../../animation/create-reveal-timeline';

export interface QrBackingPlaneProps {
  matrix: QrMatrix;
  foreground: string;
  background: string;
  values: RefObject<RevealValues | null>;
}

/**
 * The scan-safe backing layer (spec §9.3).
 *
 * It carries the mathematically exact QR — quiet zone included — behind the
 * voxels, in the same colours. The transformation stays fully 3D; the scanning
 * state becomes exact, because any sub-pixel seam between two cubes falls on a
 * correct pixel instead of on the backdrop.
 */
export function QrBackingPlane({ matrix, foreground, background, values }: QrBackingPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    // 12 device pixels per module keeps the texture crisp at any sensible
    // on-screen size while staying well inside texture limits.
    drawCanonicalQr(context, matrix, { foreground, background, modulePixels: 12 });
    const created = new THREE.CanvasTexture(canvas);
    created.magFilter = THREE.NearestFilter;
    created.minFilter = THREE.NearestFilter;
    created.generateMipmaps = false;
    created.colorSpace = THREE.SRGBColorSpace;
    created.anisotropy = 1;
    return created;
  }, [matrix, foreground, background]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame(() => {
    const mesh = meshRef.current;
    const reveal = values.current;
    if (!mesh || !reveal) return;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = reveal.backing;
    mesh.visible = reveal.backing > 0.001;
  });

  if (!texture) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, -0.55]} visible={false} renderOrder={-1}>
      <planeGeometry args={[matrix.total, matrix.total]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0}
        toneMapped={false}
        fog={false}
        depthWrite={false}
      />
    </mesh>
  );
}
