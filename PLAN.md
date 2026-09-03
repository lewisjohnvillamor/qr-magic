# VoxelQR — Production Plan

**Source spec:** _VoxelQR Product and Implementation Specification v1.0_
**Plan version:** 1.4 · **Status:** shipped, iterating

> **v1.1 revisions (post-review):** the transformation was rebuilt around the
> ground-base mechanic — the code is the plinth the sculpture stands on, and
> the reveal is a camera tilt to top-down while the sculpture is absorbed by
> the code. Modules are coloured per-theme (contrast-floored mosaic) instead
> of flat near-black. Added: per-theme synthesised ambient loops, an
> `?embed=1` widget mode with an iframe snippet (CSP allows framing by
> design), off-screen render pausing, and an idle fast-path that skips the
> per-instance loop entirely while nothing animates.
> **v1.2 revisions:** shared links now open **read-only** — a recipient gets
> the sculpture, the reveal and the Share/Embed/Save actions, but none of the
> authoring controls, keyed off a `view=1` flag that Share and Embed add and
> the address-bar sync never does. A licensed cinematic bed (CC BY 4.0, see
> ATTRIBUTION.md) sits under the synthesised ambience, transcoded to 64 kbps
> mono and crossfaded to loop seamlessly, fetched only on unmute.
> **v1.3 revisions:** each theme now has its own licensed track rather than
> sharing one, cut to a seamless ~77 s loop by `tools/build-audio.py`. The
> scene also shows **live weather where it is being viewed** — rain, snow,
> fog, cloud, wind and night, graded on top of the theme rather than replacing
> it. Location comes from the browser's time zone (no permission prompt, and
> no weather at all for an offset-only zone), conditions from Open-Meteo. This
> is the product's first and only third-party request; `connect-src` names
> that single host and an e2e test asserts the destination URL is never
> transmitted. The falling layer fades out before the code locks, and the
> decode matrix now covers storm, heavy snow and night fog.
> **v1.4 revisions:** the app sizes itself to the _small_ viewport, so nothing
> hides under a phone's address bar — the theme and sculpture rows were
> unreachable on mobile. Precipitation is now shaped from the screen's aspect
> rather than from the sculpture, so a portrait phone gets rain top to bottom
> at the same particle cost. The soundtrack is five lofi pieces. **Brand moved
> from a theme to a sculpture** — an LV monogram — taking the custom-colour
> pickers and the payload's colour fields with it; links that still name the
> old theme fall back to the default. The masthead carries a contact
> invitation, and the weather names the city it is reporting for.
> **Shape:** client-only static site. No backend, no database, no accounts.

---

## 1. Guiding constraint

> The sculpture earns attention; the QR code must still scan.

Every decision below is subordinate to that. Where visual ambition and decode
reliability conflict, decode reliability wins, and the conflict is resolved in code
(a canonical backing layer, an exact lock state) rather than by hoping the render is
close enough.

---

## 2. Architecture

```
React UI  ──►  experience store (validated state)
                 │
                 ├──►  qr/          normalize-url → generate-matrix (deterministic bool[][])
                 ├──►  sharing/     zod schema → base64url codec (?experience=)
                 └──►  themes/      palette + contrast guarantee
                          │
                 voxel/  build-qr-layout + build-sculpture-layout → VoxelInstance[]
                          │
                 animation/  one reversible GSAP master timeline → progress 0..1
                          │
                 scene/   InstancedMesh (one draw call) + scan-safe backing plane
```

**Boundaries held as invariants**

| Module                 | Owns                                     | Never does                        |
| ---------------------- | ---------------------------------------- | --------------------------------- |
| `src/app`              | product state, validation, a11y wiring   | render 3D, own matrices           |
| `src/qr`               | URL normalization, boolean module matrix | know about voxels or themes       |
| `src/voxel`            | module → instance positions, layout math | fetch, validate, or animate       |
| `src/animation`        | one master timeline, motion preferences  | generate QR data or validate URLs |
| `src/components/scene` | rendering only                           | own application state             |
| `src/sharing`          | serialize public config                  | serialize anything private        |

The scene reads state; it does not hold it. React state never updates per frame —
the animation loop writes into a mutable ref and an `InstancedMesh`.

---

## 3. Decode-reliability strategy (the core risk)

Rendering a QR out of 3D cubes is the whole product and the whole risk. Three
layers of defence, in order:

1. **Exact lock geometry.** At timeline progress 1 the camera sits on the +Z axis
   looking at the origin, the QR plane is at z = 0 and perfectly frontal, rotations
   snap to zero and module spacing is exactly 1 unit. A frontal flat plane under a
   perspective camera is undistorted, so no projection error is introduced.
2. **Canonical backing layer.** A `CanvasTexture` carrying the mathematically exact
   QR (quiet zone included, `NearestFilter`, no mipmaps) sits at z = −0.02 behind the
   voxels in the same foreground/background colours. Anti-aliased voxel edges and
   sub-pixel seams therefore fall onto correct pixels rather than onto background.
3. **Contrast floor.** Themes may tint the sculpture freely, but the QR state is
   forced to a palette whose foreground/background contrast ratio is ≥ 7:1 and whose
   foreground is the darker of the pair. `themes/contrast.ts` computes this; a unit
   test asserts every shipped theme and every brand-colour pair passes.

Plus a hard gate: **CI fails the build if the rendered QR does not decode.** The
Playwright suite screenshots the live scene in its scan-ready state and decodes with
ZXing across viewports, DPRs, themes, sculptures and URL lengths.

---

## 4. Milestones and exit criteria

| #   | Milestone                                                                        | Exit criterion                                                                      |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Foundation — Vite/React/TS, lint, format, test, CI, shell, state, URL validation | Valid URL enters state; normalization + rejection fully unit-tested                 |
| 2   | Reliable 2D QR + share codec                                                     | Canonical QR decodes across the viewport matrix; payloads round-trip and fail safe  |
| 3   | Voxel scene                                                                      | Every procedural sculpture renders in one instanced draw call, holding frame budget |
| 4   | QR transformation                                                                | WebGL-rendered QR decodes; reverse returns without state corruption                 |
| 5   | Themes and sharing                                                               | Every theme × sculpture combination survives share round-trip and decode            |
| 6   | Production hardening                                                             | A11y, reduced motion, fallback, CSP, performance budgets, full decode matrix green  |

---

## 5. Performance budget

| Metric             | Target                     | Mechanism                                                                  |
| ------------------ | -------------------------- | -------------------------------------------------------------------------- |
| Draw calls (scene) | < 12                       | one `InstancedMesh` for voxels, one plane, one backdrop                    |
| Desktop            | ~60 FPS                    | no per-frame allocation; pre-allocated `Matrix4`/`Vector3`/`Color` scratch |
| Mid mobile         | ≥ 30 FPS                   | quality tiers cut voxel count, particles, shadows                          |
| DPR                | capped at 2 (1.5 on `low`) | measured at mount, re-evaluated on resize                                  |
| Hidden tab         | 0 frames                   | `document.visibilitychange` pauses the loop                                |
| Init               | UI usable before 3D        | scene is lazy-loaded behind `Suspense`; controls render immediately        |

Quality tiers: **high** (shadows, particles, full voxel count) · **medium** (no
shadows, fewer particles) · **low** (no shadows, no particles, reduced decorative
voxels) · **fallback** (2D canvas QR, no WebGL).

---

## 6. Accessibility contract

Nothing requires touching the canvas. Every action — reveal, return, share, mute,
sculpture, theme, quality — is a labelled control with a visible focus ring. URL
errors and the scan-ready state are announced through a polite ARIA live region.
State is never signalled by colour alone. `prefers-reduced-motion` replaces the
scatter choreography with a short crossfade and stops idle rotation while keeping
every feature reachable.

---

## 7. Security and privacy

Local-only QR generation; no analytics; exactly one network call after load —
the weather lookup, sent a pair of coordinates and nothing else (`connect-src
'self' https://api.open-meteo.com`). Only `http:` and `https:` destinations are accepted, capped at 1,200
characters. The app never navigates to a user-entered URL and never writes user input
into raw HTML. Share links carry a versioned, zod-parsed, size-capped Base64URL
payload; the UI states plainly that the link contains the destination and that the
encoding is not encryption. A restrictive CSP ships with both the dev server and the
static host.

---

## 8. Test strategy

**Unit (Vitest):** URL normalization and rejection · matrix generation determinism ·
voxel-to-module mapping · seeded layout determinism · share encode/decode, version
skew, tampering, oversize, retired themes · theme contrast · quality-tier
selection · weather parsing and grading.

**Component (Testing Library):** control panel flow, keyboard operation, live-region
announcements, fallback rendering.

**End-to-end (Playwright + ZXing):** reveal the QR in a real browser, screenshot the
scan-ready state, decode, and assert equality with the normalized URL — across
320/375/430 px mobile widths, two desktop widths, DPR 1 and 2, and every theme
and sculpture — enumerated from `THEME_IDS` and `SCULPTURE_IDS` rather than a
copied list, so adding one cannot ship without a decode test — plus short and
long URLs and reduced-motion mode. Share links are reloaded and re-decoded. The
build fails on any decode miss.

---

## 9. Definition of done

All twelve MVP acceptance criteria in spec §20, plus: `npm run verify` green,
e2e decode matrix green, no disposed-object leaks when switching sculpture or theme
50×, and zero copied ICQR branding, assets, audio or source.
