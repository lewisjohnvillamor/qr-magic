# Third-party attribution

## Music

Six pieces by **Kevin MacLeod** (incompetech.com), one per theme:

| Theme   | Track            | ISRC         | File                       |
| ------- | ---------------- | ------------ | -------------------------- |
| Nature  | Ripples          | USUAN1100691 | `public/audio/nature.mp3`  |
| Cyber   | Ethernight Club  | USUAN2100002 | `public/audio/cyber.mp3`   |
| Crystal | Melodie Victoria | USUAN1100819 | `public/audio/crystal.mp3` |
| Sunset  | Evening          | USUAN2300002 | `public/audio/sunset.mp3`  |
| Snow    | Frost Waltz      | USUAN1100516 | `public/audio/snow.mp3`    |
| Brand   | Our Story Begins | USUAN1100856 | `public/audio/brand.mp3`   |

- Source: https://incompetech.com/music/royalty-free/
- Licence: **Creative Commons Attribution 4.0** —
  http://creativecommons.org/licenses/by/4.0/
- Changes made: each track was cut to a single ~77-second passage, crossfaded
  end-to-start so it loops seamlessly, and encoded mono at 64 kbps. CC BY 4.0
  permits this and requires the change to be stated, which is what this line is
  for. The transformation is reproducible: `tools/build-audio.py`.

CC BY 4.0 permits commercial use and redistribution, including inside the
embeddable widget, provided the credit above travels with it. The credit is
therefore shown in the running application, as the sound control's tooltip
naming whichever piece is playing (`musicCredit` in `src/lib/music.ts`), not
only in this file — so it reaches anyone who embeds VoxelQR on their own site.

Attribution text required by the licensor, per track:

> "<Track>" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

## Weather data

Current conditions come from **Open-Meteo** (https://open-meteo.com), used
without an API key under their free non-commercial terms; their data is
licensed CC BY 4.0. Commercial deployments should review
https://open-meteo.com/en/pricing.

VoxelQR sends Open-Meteo a pair of coordinates and nothing else. Those
coordinates are the reference city of the viewer's IANA time zone — never their
actual position, which is never requested. The destination URL is never
transmitted to Open-Meteo or anywhere else.

## Time zone coordinates

`src/lib/timezone-coordinates.ts` is generated from the IANA time zone database
(`zone1970.tab`), which is in the public domain. See `tools/build-timezones.py`.

## Everything else

All other assets in this repository — 3D content, sound cues, the ambient
synthesis, icons, interface design and source code — are original to this
project. No ICQR branding, assets, audio or code are used.
