import { ScanCue } from './ScanCue';
import { ShareActions } from './ShareActions';
import type { Phase } from '../../app/experience-store';

export interface ViewerPanelProps {
  /** Where the code points, shown so a recipient can see it before scanning. */
  destination: string;
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
            <a className="viewer-destination" href={props.destination} rel="noreferrer noopener">
              {props.destination}
            </a>
          </p>
        )}
        <span className="spacer" />
        <ShareActions onShare={props.onShare} onEmbed={props.onEmbed} onSavePng={props.onSavePng} />
      </div>
    </div>
  );
}
