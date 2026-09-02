#!/usr/bin/env python3
"""Turn full-length source tracks into small, seamlessly looping ambient beds.

The music is a bed under a 3D scene, playing quietly beneath a synthesised pad.
Shipping 3-to-5-minute 320 kbps stereo masters for that is wasteful on every
axis, so each track is reduced to the part worth looping and encoded at a
bitrate matched to how it is actually heard:

1. Pick the most sustained window of the track, avoiding the intro and outro
   where a piece fades in or resolves. Those edges are what make a naive loop
   sound like it restarts.
2. Crossfade the tail back over the head, so the seam is a blend rather than
   a cut and the loop has no audible restart at all.
3. Normalise, then encode mono at a low bitrate. At this volume, under a pad,
   mono is indistinguishable from stereo and costs a fifth as much.

Requires `av` and `lameenc` (not project dependencies — this is a one-off
asset pipeline, and its output is committed):

    pip install av lameenc numpy
    python3 tools/build-audio.py <source-dir> <output-dir>
"""

import sys
from pathlib import Path

import av
import lameenc
import numpy as np

RATE = 44100
"""Working sample rate. Matches the sources, so no resampling artefacts."""

LOOP_SECONDS = 80.0
"""Target loop length. Long enough not to feel repetitive, short enough that a
visitor downloads well under a megabyte."""

CROSSFADE_SECONDS = 3.0
"""Overlap folded from the tail back onto the head to hide the loop seam."""

EDGE_TRIM_SECONDS = 8.0
"""Ignored at each end when choosing a window: a fade-in or a final resolve is
never the part you want to loop."""

BITRATE_KBPS = 64
PEAK = 0.95


def decode_mono(path: Path) -> np.ndarray:
    """Decode any source file to a mono float array at RATE."""
    container = av.open(str(path))
    stream = container.streams.audio[0]
    resampler = av.AudioResampler(format='s16', layout='mono', rate=RATE)
    chunks = []
    for frame in container.decode(stream):
        for out in resampler.resample(frame):
            chunks.append(out.to_ndarray().reshape(-1))
    for out in resampler.resample(None):
        chunks.append(out.to_ndarray().reshape(-1))
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def choose_window(pcm: np.ndarray, length: int) -> int:
    """Return the start sample of the most sustained `length`-sample window.

    Loudness alone would favour a climax, which loops badly because the energy
    has to fall off a cliff at the seam. What loops well is a stretch that
    stays at one level, so windows are ranked on mean energy minus its own
    variation across the window.
    """
    trim = int(EDGE_TRIM_SECONDS * RATE)
    usable = len(pcm) - 2 * trim
    if usable <= length:
        # Too short to be choosy: centre the window on whatever exists.
        return max(0, (len(pcm) - length) // 2)

    # One RMS value per 0.5 s, which is fine granularity for a 80 s window.
    hop = RATE // 2
    frames = pcm[trim : trim + (usable // hop) * hop].reshape(-1, hop)
    rms = np.sqrt((frames.astype(np.float64) ** 2).mean(axis=1) + 1e-12)

    span = max(1, length // hop)
    best_score, best_frame = -np.inf, 0
    for start in range(0, len(rms) - span + 1):
        window = rms[start : start + span]
        score = window.mean() - window.std()
        if score > best_score:
            best_score, best_frame = score, start
    return trim + best_frame * hop


def make_loop(pcm: np.ndarray) -> np.ndarray:
    """Cut the chosen window and crossfade it into a seamless loop."""
    length = min(len(pcm), int(LOOP_SECONDS * RATE))
    start = choose_window(pcm, length)
    clip = pcm[start : start + length]

    fade = int(CROSSFADE_SECONDS * RATE)
    if len(clip) <= fade * 2:
        return clip
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
    head, tail = clip[:fade], clip[-fade:]
    return np.concatenate([tail * (1 - ramp) + head * ramp, clip[fade:-fade]])


def encode(pcm: np.ndarray, path: Path) -> int:
    peak = float(np.abs(pcm).max()) or 1.0
    samples = (pcm / peak * PEAK * 32767.0).astype(np.int16)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE_KBPS)
    encoder.set_in_sample_rate(RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    data = encoder.encode(samples.tobytes()) + encoder.flush()
    path.write_bytes(data)
    return len(data)


def main() -> None:
    source_dir, output_dir = Path(sys.argv[1]), Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    for source in sorted(source_dir.glob('*.src.mp3')):
        name = source.name.removesuffix('.src.mp3')
        pcm = decode_mono(source)
        loop = make_loop(pcm)
        size = encode(loop, output_dir / f'{name}.mp3')
        print(f'{name:8} {len(pcm) / RATE:6.1f}s -> {len(loop) / RATE:5.1f}s  {size / 1024:6.0f} KB')


if __name__ == '__main__':
    main()
