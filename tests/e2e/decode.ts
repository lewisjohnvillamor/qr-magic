import { PNG } from 'pngjs';
import zxing from '@zxing/library';
import jsQR from 'jsqr';

const {
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} = zxing as unknown as typeof import('@zxing/library');

/**
 * Decode a PNG screenshot with ZXing.
 *
 * This is the build gate: if this returns null for the scan-ready state, the QR
 * is not scannable and the release is not shippable, however good it looks.
 */
export function decodeQrFromPng(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;

  // ZXing's RGB source expects packed 0xRRGGBB integers.
  const packed = new Int32Array(width * height);
  for (let i = 0; i < packed.length; i += 1) {
    const offset = i * 4;
    packed[i] =
      ((data[offset] as number) << 16) |
      ((data[offset + 1] as number) << 8) |
      (data[offset + 2] as number);
  }

  const source = new RGBLuminanceSource(packed, width, height);

  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);

  /**
   * Two binarizers, as a real scanner does.
   *
   * `HybridBinarizer` thresholds in 8x8 blocks, which struggles when the module
   * pitch lands near 8 screen pixels; `GlobalHistogramBinarizer` handles the
   * evenly-lit synthetic case. A code that either one reads is a code a phone
   * reads, and requiring both would fail the build on a quirk of one algorithm
   * rather than on a defect in the product.
   */
  for (const Binarizer of [HybridBinarizer, GlobalHistogramBinarizer]) {
    const reader = new QRCodeReader();
    try {
      return reader.decode(new BinaryBitmap(new Binarizer(source)), hints).getText();
    } catch {
      continue;
    } finally {
      reader.reset();
    }
  }

  /**
   * Independent second opinion. The @zxing/library JS port throws a
   * ChecksumException on some perfectly valid codes — reproducible on the
   * canonical PNG that the `qrcode` library itself emits for certain URLs
   * (e.g. https://example.com/tree), with the module grid verified
   * pixel-exact against the source matrix. jsqr decodes those. A code that a
   * conformant decoder reads is a scannable code; failing the build on one
   * port's defect would gate the product on the wrong thing.
   */
  const fallback = jsQR(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    width,
    height,
  );
  return fallback ? fallback.data : null;
}
