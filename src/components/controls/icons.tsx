/**
 * Interface icons.
 *
 * Drawn inline as SVG rather than pulled from an icon font: they inherit
 * `currentColor` so every theme tints them for free, they add nothing to the
 * network cost, and there is no third-party asset in the product.
 *
 * Each is decorative — every button carries its own `aria-label`, so the icons
 * are hidden from assistive technology.
 */

import type { ReactNode } from 'react';

export type IconName = 'share' | 'embed' | 'download' | 'sound-on' | 'sound-off' | 'check';

const PATHS: Record<IconName, ReactNode> = {
  share: (
    <>
      <path d="M4 9v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9" />
      <path d="M10 12.5V3" />
      <path d="m6.5 6.5 3.5-3.5 3.5 3.5" />
    </>
  ),
  embed: (
    <>
      <path d="m7 6-5 4 5 4" />
      <path d="m13 6 5 4-5 4" />
    </>
  ),
  download: (
    <>
      <path d="M4 13v4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4" />
      <path d="M10 3v9" />
      <path d="m6.5 8.5 3.5 3.5 3.5-3.5" />
    </>
  ),
  'sound-on': (
    <>
      <path d="M4 8h3l4-3.5v11L7 12H4z" />
      <path d="M14 7.5a4 4 0 0 1 0 5" />
      <path d="M16.5 5a7 7 0 0 1 0 10" />
    </>
  ),
  'sound-off': (
    <>
      <path d="M4 8h3l4-3.5v11L7 12H4z" />
      <path d="m14 8 4 4" />
      <path d="m18 8-4 4" />
    </>
  ),
  check: <path d="m4 10.5 4 4 8-9" />,
};

export interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export interface IconButtonProps {
  icon: IconName;
  /** The button's accessible name — icons alone never carry meaning. */
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  testId?: string;
}

/**
 * An icon-only button.
 *
 * `aria-label` supplies the name for screen readers and the `title` gives
 * sighted users a hover tooltip, so nothing depends on recognising the glyph.
 */
export function IconButton({
  icon,
  label,
  onClick,
  pressed,
  className = '',
  testId,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <Icon name={icon} />
    </button>
  );
}
