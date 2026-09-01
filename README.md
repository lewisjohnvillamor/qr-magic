# VoxelQR

**Turn any link into a living 3D voxel sculpture that transforms into a QR code.**

VoxelQR renders a link as a voxel sculpture you can nudge with a pointer. Press
**Reveal QR** and the cubes scatter, reorganise and lock into a scannable QR code.
Press **Return to sculpture** and the same timeline runs backwards.

Everything happens in the browser. There is no backend, no database, no account,
and the destination link is never sent anywhere.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script                            | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run dev`                     | Dev server with the production CSP applied              |
| `npm run build`                   | Typecheck and build to `dist/`                          |
| `npm run preview`                 | Serve `dist/` on port 4173                              |
| `npm test`                        | Unit and component tests (Vitest)                       |
| `npm run test:e2e`                | Browser tests, including the ZXing decode matrix        |
| `npm run lint` / `npm run format` | ESLint / Prettier                                       |
| `npm run verify`                  | Format check, lint, unit tests and build — what CI runs |

The end-to-end suite builds nothing itself; run `npm run build` first, or let the
Playwright web server do it via `npm run preview`.

---

## How it works

```
React UI  ──►  experience store (validated state)
                 │
                 ├──►  src/qr/        normalize-url → generate-matrix (boolean module matrix)
                 ├──►  src/sharing/   zod schema → base64url codec (?experience=)
                 └──►  src/themes/    palette + contrast guarantee
                          │
              src/voxel/  build-qr-layout + build-sculpture-layout → VoxelInstance[]
                          │
          src/animation/  one reversible GSAP master timeline → progress 0..1
                          │
   src/components/scene/  InstancedMesh (one draw call) + scan-safe backing plane
```

Each module owns one thing. The QR engine does not know what a voxel is; the
scene renders but never holds application state; GSAP animates but never
validates a URL. Nothing calls `setState` during the animation loop — the frame
loop writes matrices into a single `InstancedMesh`.

### Why the code actually scans

Rendering a QR out of cubes is the entire product and the entire risk, so
reliability is enforced in three places rather than hoped for:

1. **Exact lock geometry.** At the end of the timeline the camera looks straight
   down −Z, the QR plane sits frontally at z = 0, rotations are zero and module
   spacing is exactly one world unit. A frontal flat plane under a perspective
   camera has no projection error.
2. **A canonical backing layer.** A nearest-filtered `CanvasTexture` carrying the
   mathematically exact code — quiet zone included — sits just behind the voxels
   in the same colours, so anti-aliased cube edges land on correct pixels.
3. **A shader-level flat lock.** At the lock stage the lit result is replaced by
   the raw instance colour, so lighting, fog and shadows cannot tint a module.

On top of that, `toScanSafePair` guarantees at least a 7:1 contrast ratio with
the darker colour as the foreground, for every theme and for any brand colours a
user picks.

And it is a build gate: `tests/e2e/qr-decode.spec.ts` screenshots the live WebGL
canvas in its scan-ready state and decodes it with ZXing across six viewports and
pixel densities, all six themes, all six sculptures, short and long URLs, and
reduced-motion mode. A code that will not decode fails CI.

---

## Sculptures and themes

Six procedural sculptures — floating cube, crystal, gift box, miniature city,
island, abstract portal — and six themes — Nature, Cyber, Crystal, Sunset, Snow
and Brand (your own two colours). All layouts are seeded from the destination
URL, so the same link always produces the same sculpture.

---

## Sharing

The current destination and appearance are encoded into the address bar as a
versioned, Base64URL-encoded JSON payload under `?experience=`, parsed with Zod on
the way back in. Unknown fields are ignored, invalid sculptures and themes fall
back to defaults, and an oversized or manipulated payload loads the default
experience instead of breaking the page.

**Share links contain the destination URL in plain sight.** It is encoded, not
encrypted, and the interface says so.

---

## Accessibility

Nothing requires touching the canvas. Reveal, return, share, mute, sculpture and
theme are all labelled controls with visible focus, the sculpture and theme
pickers are arrow-key radio groups, and URL errors and the scan-ready state are
announced through a polite live region. State is never signalled by colour alone.
With `prefers-reduced-motion` the scatter choreography is replaced by a short
interpolation and idle rotation stops, with no loss of function.

---

## Performance

One `InstancedMesh` draws every cube. No vectors, matrices or colours are
allocated inside the frame loop. Rendering stops entirely when the tab is hidden,
and the device pixel ratio is capped by the active quality tier:

| Tier     | Cubes | Shadows | Particles |      Max DPR |
| -------- | ----: | ------- | --------: | -----------: |
| High     |  1400 | yes     |       260 |            2 |
| Medium   |   900 | no      |       120 |         1.75 |
| Low      |   520 | no      |         0 |          1.5 |
| Fallback |     — | —       |         — | 2D canvas QR |

---

## Security and privacy

QR generation is local, only `http:` and `https:` destinations are accepted (up
to 1,200 characters), unsafe schemes are rejected on entry _and_ again when a
share link is decoded, and the app never navigates to a user-entered URL. No
analytics, no third-party requests: an end-to-end test asserts that nothing ever
leaves the app's own origin. A restrictive CSP ships with the dev server, the
preview server, `public/_headers` and `vercel.json`.

---

## Deployment

Static output in `dist/`. `vercel.json` and `public/_headers` carry matching
security headers for Vercel and Cloudflare Pages respectively; any static host
works as long as the headers come with it.

---

## Development notes

Three.js and GSAP guidance were used while building this (scene and instancing
discipline, timeline and cleanup practice). They are development references, not
runtime dependencies. Three.js DevTools MCP is optional tooling for inspecting a
live scene; the deployed product does not depend on it.

This product contains no third-party branding, assets, audio or source code. The
two sound cues are synthesised at runtime with the Web Audio API, and start
muted.
