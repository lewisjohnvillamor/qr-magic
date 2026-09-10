import { ScanCue } from './ScanCue';
import { ShareActions } from './ShareActions';
import type { Phase } from '../../app/experience-store';

export interface ViewerPanelProps {
  /** What the code carries, shown so a recipient can see it before scanning. */
  destination: string;
  /** True when the destination is a web address and can be opened directly. */
  isLink: boolean;
  phase: Phase;
  onShare: () => void;
  onEmbed: () => void;
  onSavePng: () => void;
}

/**
 * The bar shown to someone who opened a shared link.
 *
 * A recipient did not author this experience, so none of the authoring
 * controls appear: no link field, no sculpture or theme pickers. What is left
 * is the sculpture itself, the code it becomes, and the three things worth
 * doing with someone else's work — pass it on, embed it, keep a picture.
 */
export function ViewerPanel(props: ViewerPanelProps) {
  const scanReady = props.phase === 'scan-ready';

  return (
    <div className="panel panel--compact" data-testid="viewer-panel">
      <div className="panel-card">
        {scanReady ? (
          <ScanCue />
        ) : (
          <p className="scan-cue">
            <strong>Shared with you</strong>
            {/* The destination is disclosed rather than hidden behind the
                reveal: knowing where a stranger's code leads is the point. */}
            {/* Only a web address is offered as a link. A Wi-Fi payload or a
                contact card is disclosed as text — there is nothing safe or
                useful to navigate to, and a link that does nothing is worse
                than a line that simply says what this is. */}
            {props.isLink ? (
              <a className="viewer-destination" href={props.destination} rel="noreferrer noopener">
                {props.destination}
              </a>
            ) : (
              <span className="viewer-destination">{props.destination}</span>
            )}
          </p>
        )}
        <span className="spacer" />
        <ShareActions onShare={props.onShare} onEmbed={props.onEmbed} onSavePng={props.onSavePng} />
      </div>
    </div>
  );
}
