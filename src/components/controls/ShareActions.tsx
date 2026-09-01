import { useState } from 'react';
import { IconButton } from './icons';

export interface ShareActionsProps {
  onShare: () => void;
  onEmbed: () => void;
  onSavePng: () => void;
}

/**
 * Share, embed and save — the three things you do with a finished experience.
 *
 * Both the author's panel and the read-only viewer show exactly this row, so
 * the copy-confirmation behaviour lives here once rather than twice.
 */
export function ShareActions(props: ShareActionsProps) {
  const [shareCopied, setShareCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  // The icon swaps to a tick for a moment, so a copy that opens no dialog
  // still tells you it happened.
  const flash = (setter: (value: boolean) => void) => {
    setter(true);
    window.setTimeout(() => setter(false), 2400);
  };

  return (
    <div className="card-actions">
      <IconButton
        icon={shareCopied ? 'check' : 'share'}
        label={shareCopied ? 'Link copied' : 'Share'}
        title={
          shareCopied
            ? 'Link copied'
            : 'Share — the link opens the full 3D sculpture, and carries your destination encoded, not encrypted'
        }
        onClick={() => {
          props.onShare();
          flash(setShareCopied);
        }}
      />
      <IconButton
        icon={embedCopied ? 'check' : 'embed'}
        label={embedCopied ? 'Code copied' : 'Embed'}
        onClick={() => {
          props.onEmbed();
          flash(setEmbedCopied);
        }}
      />
      <IconButton icon="download" label="Save image" onClick={props.onSavePng} />
    </div>
  );
}
