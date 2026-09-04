import { IconButton } from './controls/icons';
import { WeatherBadge } from './WeatherBadge';
import type { Weather } from '../lib/weather';

/**
 * Where the invitation goes.
 *
 * A Buy Me a Coffee page rather than a `mailto:` — it carries a message form,
 * so it serves the commission enquiry and the tip alike, and it keeps a
 * personal address off a page that anyone can embed anywhere.
 */
const SUPPORT_URL = 'https://buymeacoffee.com/lewisjohnvil';

export interface MastheadProps {
  /** Hidden while the code is locked: nothing should sit near a scan target. */
  dimmed: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  /** Credit for whichever track is playing, as required by its licence. */
  musicCredit: string;
  weather: Weather | null;
}

/**
 * The top bar: who made this and how to reach them, with the two live readouts
 * — weather and sound — kept together on the right.
 *
 * The invitation is the point of the line rather than a tagline about the
 * product: someone looking at a sculpture of their own link already knows what
 * it is, so the useful thing to tell them is that it can be made theirs — and
 * where to go to ask for that, or to say thanks.
 */
export function Masthead({ dimmed, muted, onToggleMuted, musicCredit, weather }: MastheadProps) {
  return (
    <header className="masthead" data-dimmed={dimmed ? 'true' : 'false'}>
      <div className="masthead-brand">
        <h1 className="wordmark">VoxelQR</h1>
        <p className="tagline">
          Interested in customizing this to your brand?{' '}
          <a
            className="support-link"
            href={SUPPORT_URL}
            target="_blank"
            rel="noreferrer noopener"
            title="Say hello, commission a custom build, or just buy me a coffee"
          >
            <span aria-hidden="true">☕</span> Buy me a coffee
          </a>
        </p>
      </div>
      <span className="spacer" />
      {/* Grouped so the weather sits level with the sound control rather than
          on the wordmark's baseline. */}
      <div className="masthead-tools">
        <WeatherBadge weather={weather} />
        <IconButton
          icon={muted ? 'sound-off' : 'sound-on'}
          label={muted ? 'Sound off' : 'Sound on'}
          title={musicCredit}
          onClick={onToggleMuted}
          pressed={!muted}
          className="masthead-action"
        />
      </div>
    </header>
  );
}
