/**
 * What to do while the code is locked and scannable.
 *
 * Both panels show this, word for word — which is exactly why it lives in one
 * place. The last copy change had to be made twice, and the second line is
 * load-bearing now that pressing the code is the only way back.
 */
export function ScanCue() {
  return (
    <p className="scan-cue">
      <strong>Scan now</strong>
      <span>Point a camera at the code, or press it to go back.</span>
    </p>
  );
}
