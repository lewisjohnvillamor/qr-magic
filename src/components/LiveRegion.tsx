export interface LiveRegionProps {
  message: string;
}

/** Polite announcements for URL errors and the scan-ready state (spec §16). */
export function LiveRegion({ message }: LiveRegionProps) {
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
