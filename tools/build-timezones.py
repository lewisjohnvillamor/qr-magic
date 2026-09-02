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


def main() -> None:
    zones: dict[str, tuple[float, float]] = {}
    read_table(TZ_DIR / 'zone1970.tab', zones)
    # zone.tab still carries the older aliases some browsers report.
    read_table(TZ_DIR / 'zone.tab', zones)
    for zone, (lat, lon) in sorted(zones.items()):
        print(f"  '{zone}': [{lat}, {lon}],", file=sys.stderr)
    print(f'{len(zones)} zones', file=sys.stderr)


if __name__ == '__main__':
    main()
