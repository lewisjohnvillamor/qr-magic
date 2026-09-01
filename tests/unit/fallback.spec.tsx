import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FallbackQr } from '../../src/components/fallback/FallbackQr';
import { LiveRegion } from '../../src/components/LiveRegion';
import { generateMatrix } from '../../src/qr/generate-matrix';
import { drawCanonicalQr } from '../../src/qr/draw-canonical';

const matrix = generateMatrix('https://example.com/fallback');

describe('FallbackQr', () => {
  beforeEach(() => {
    // jsdom has no 2D canvas implementation; record the calls instead.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 0, height: 0 },
      fillRect: vi.fn(),
      set fillStyle(_value: string) {},
      set imageSmoothingEnabled(_value: boolean) {},
    })) as unknown as HTMLCanvasElement['getContext'];
  });

  it('renders an accessible image with the destination in its label', () => {
    render(
      <FallbackQr
        matrix={matrix}
        foreground="#111111"
        background="#ffffff"
        reason="No WebGL here."
      />,
    );
    expect(screen.getByRole('img', { name: /https:\/\/example\.com\/fallback/ })).toBeVisible();
    expect(screen.getByText('No WebGL here.')).toBeInTheDocument();
  });
});

describe('drawCanonicalQr', () => {
  it('sizes the canvas to whole modules including the quiet zone', () => {
    const calls: number[][] = [];
    const context = {
      canvas: { width: 0, height: 0 },
      fillRect: (...args: number[]) => calls.push(args),
      fillStyle: '',
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D;

    const { pixelSize, modulePixels } = drawCanonicalQr(context, matrix, {
      foreground: '#000000',
      background: '#ffffff',
      modulePixels: 6,
    });

    expect(modulePixels).toBe(6);
    expect(pixelSize).toBe(matrix.total * 6);
    expect(context.canvas.width).toBe(pixelSize);
    // First call paints the background, the rest are dark modules.
    expect(calls[0]).toEqual([0, 0, pixelSize, pixelSize]);
    for (const [x, y, w, h] of calls.slice(1)) {
      expect(w).toBe(6);
      expect(h).toBe(6);
      expect((x as number) % 6).toBe(0);
      expect((y as number) % 6).toBe(0);
    }
  });

  it('always uses whole-pixel modules even when asked for fractions', () => {
    const context = {
      canvas: { width: 0, height: 0 },
      fillRect: () => {},
      fillStyle: '',
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D;
    const { modulePixels } = drawCanonicalQr(context, matrix, {
      foreground: '#000000',
      background: '#ffffff',
      modulePixels: 7.6,
    });
    expect(Number.isInteger(modulePixels)).toBe(true);
  });
});

describe('LiveRegion', () => {
  it('is a polite status region', () => {
    render(<LiveRegion message="Scan ready." />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Scan ready.');
  });
});
