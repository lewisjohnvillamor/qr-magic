import { PNG } from 'pngjs';

/**
 * Box-filter downscale.
 *
 * Standing further from a screen, or scanning with a cheaper sensor, is
 * optically close to sampling the same image at fewer pixels. Shrinking a
 * capture and re-decoding it therefore measures how much headroom the code has
 * before module boundaries blur into each other — a number, rather than a
 * feeling, for "does this scan well".
 */
export function downscalePng(buffer: Buffer, factor: number): Buffer {
  const source = PNG.sync.read(buffer);
  const width = Math.max(1, Math.round(source.width * factor));
  const height = Math.max(1, Math.round(source.height * factor));
  const out = new PNG({ width, height });

  const sx = source.width / width;
  const sy = source.height / height;

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1 && yy < source.height; yy += 1) {
        for (let xx = x0; xx < x1 && xx < source.width; xx += 1) {
          const o = (yy * source.width + xx) * 4;
          r += source.data[o] as number;
          g += source.data[o + 1] as number;
          b += source.data[o + 2] as number;
          n += 1;
        }
      }
      const o = (y * width + x) * 4;
      out.data[o] = Math.round(r / n);
      out.data[o + 1] = Math.round(g / n);
      out.data[o + 2] = Math.round(b / n);
      out.data[o + 3] = 255;
    }
  }
  return PNG.sync.write(out);
}
