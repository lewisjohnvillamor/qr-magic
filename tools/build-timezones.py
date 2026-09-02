#!/usr/bin/env python3
"""Generate `src/lib/timezone-coordinates.ts` from the IANA time zone database.

The scene shows the weather where it is being viewed. Asking the browser for a
precise location would mean a permission prompt, which a widget embedded in
someone else's page cannot reasonably ask for and would usually be denied. The
time zone is already known, needs no prompt, and resolves to a reference city —
which is exactly the resolution weather needs.

IANA ships coordinates for every zone in `zone1970.tab`, in the public domain.
This turns that into a typed lookup table.

    python3 tools/build-timezones.py > src/lib/timezone-coordinates.ts
"""

import re
import sys
from pathlib import Path

TZ_DIR = Path('/usr/share/zoneinfo')
COORD = re.compile(r'^([+-]\d{2})(\d{2})(\d{2})?([+-]\d{3})(\d{2})(\d{2})?$')


def to_degrees(degrees: str, minutes: str, seconds: str | None) -> float:
    sign = -1 if degrees.startswith('-') else 1
    return round(sign * (abs(int(degrees)) + int(minutes) / 60 + int(seconds or 0) / 3600), 2)


def read_table(path: Path, zones: dict[str, tuple[float, float]]) -> None:
    for line in path.read_text().splitlines():
        if line.startswith('#') or not line.strip():
            continue
        fields = line.split('\t')
        if len(fields) < 3:
            continue
        match = COORD.match(fields[1])
        if not match or fields[2] in zones:
            continue
        lat_d, lat_m, lat_s, lon_d, lon_m, lon_s = match.groups()
        zones[fields[2]] = (to_degrees(lat_d, lat_m, lat_s), to_degrees(lon_d, lon_m, lon_s))


HEADER = """/**
 * Approximate coordinates for every IANA time zone.
 *
 * The scene wants to know roughly where it is being viewed so it can show the
 * weather there. The browser already knows its time zone and will say so
 * without a permission prompt, which matters: a widget embedded in someone
 * else's page cannot reasonably ask a reader for their precise location, and
 * would mostly be denied if it did.
 *
 * A zone resolves to its reference city, so this is city-level at best and
 * country-level at worst. That is the right resolution for the job — weather
 * is a regional phenomenon and the scene only needs to know rain from snow —
 * and it is deliberately *not* the viewer's actual position.
 *
 * Generated from the public-domain IANA `zone1970.tab` and `zone.tab`. Do not
 * edit by hand; run `tools/build-timezones.py` instead.
 */

export const TIMEZONE_COORDINATES: Record<string, readonly [number, number]> = {
"""

FOOTER = """};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Zones that name an offset rather than a place.
 *
 * A browser reporting `UTC` or `Etc/GMT+5` is telling you what time it is, not
 * where it is — that is what servers, CI runners and privacy-hardened browsers
 * report. Guessing a location from an offset would put the viewer somewhere in
 * the ocean and show them its weather, which is worse than showing none, so
 * these resolve to nothing and the scene simply stays unweathered.
 */
const PLACELESS = /^(UTC|GMT|UCT|Z|Zulu|Universal|Etc\\/|GMT[+-])/;

/**
 * Best-effort coordinates for an IANA zone name.
 *
 * Unknown or renamed zones fall back to the region's own reference zone where
 * the prefix matches, so a zone added after this table was generated still
 * lands on the right continent rather than nowhere.
 */
export function coordinatesForTimeZone(zone: string): Coordinates | null {
  if (PLACELESS.test(zone)) return null;

  const exact = TIMEZONE_COORDINATES[zone];
  if (exact) return { latitude: exact[0], longitude: exact[1] };

  const region = zone.split('/')[0];
  if (!region || region === zone) return null;
  for (const [name, value] of Object.entries(TIMEZONE_COORDINATES)) {
    if (name.startsWith(`${region}/`)) return { latitude: value[0], longitude: value[1] };
  }
  return null;
}
"""


def main() -> None:
    zones: dict[str, tuple[float, float]] = {}
    read_table(TZ_DIR / 'zone1970.tab', zones)
    # zone.tab still carries the older aliases some browsers report.
    read_table(TZ_DIR / 'zone.tab', zones)

    # The whole module goes to stdout, so the redirect in the docstring above
    # produces a file that compiles. Progress goes to stderr so it does not end
    # up inside it.
    out = [HEADER]
    out += [f"  '{zone}': [{lat}, {lon}],\n" for zone, (lat, lon) in sorted(zones.items())]
    out.append(FOOTER)
    sys.stdout.write(''.join(out))
    print(f'{len(zones)} zones', file=sys.stderr)


if __name__ == '__main__':
    main()
