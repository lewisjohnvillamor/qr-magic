import { useEffect, useRef } from 'react';
import type { QrMatrix } from '../../qr/generate-matrix';
import { drawCanonicalQr } from '../../qr/draw-canonical';

export interface FallbackQrProps {
  matrix: QrMatrix;
  foreground: string;
  background: string;
  /** Explains why the 2D code is being shown. */
  reason: string;
}

/**
 * The guaranteed-working 2D code.
 *
 * Shown when WebGL is unavailable — that is, on the weakest devices, and often
 * the poorest screens. It deliberately drops the theme mosaic and uses the
 * solid contrast-guaranteed pair (15:1 or better on every theme, against the
 * mosaic's 7:1 floor). This is the path that has to work when nothing else
 * did; decoration is the wrong trade here.
 */
export function FallbackQr({ matrix, foreground, background, reason }: FallbackQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    drawCanonicalQr(context, matrix, { foreground, background, modulePixels: 10 });
  }, [matrix, foreground, background]);

  return (
    <div className="fallback" data-testid="fallback-qr">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`QR code for ${matrix.value}`}
        data-testid="fallback-canvas"
      />
      <h2>Scan this code</h2>
      <p>{reason}</p>
    </div>
  );
}
