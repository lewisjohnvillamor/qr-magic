import { useState } from 'react';
import type { FormEvent } from 'react';
import { ChipGroup } from './ChipGroup';
import { IconButton } from './icons';
import { SCULPTURES } from '../../voxel/types';
import type { SculptureId } from '../../voxel/types';
import { THEME_IDS, THEMES } from '../../themes/themes';
import type { ThemeId } from '../../themes/themes';
import type { Phase } from '../../app/experience-store';

export interface ControlPanelProps {
  draftUrl: string;
  urlError: string | null;
  urlIsDense: boolean;
  sculpture: SculptureId;
  theme: ThemeId;
  brandForeground: string;
  brandBackground: string;
  phase: Phase;
  contrastAdjusted: boolean;
  onDraftUrlChange: (value: string) => void;
  onSubmitUrl: () => void;
  onSculptureChange: (value: SculptureId) => void;
  onThemeChange: (value: ThemeId) => void;
  onBrandColorsChange: (foreground: string, background: string) => void;
  onReturn: () => void;
  onShare: () => void;
  onEmbed: () => void;
  onSavePng: () => void;
}

const SCULPTURE_OPTIONS = SCULPTURES.map((sculpture) => ({
  id: sculpture.id,
  label: sculpture.label,
  hint: sculpture.hint,
}));

const THEME_OPTIONS = THEME_IDS.map((id) => ({
  id,
  label: THEMES[id].label,
  hint: THEMES[id].hint,
}));

/**
 * The bottom stack: a card holding the link and its three icon actions, with
 * the sculpture and theme pickers as a footer beneath it.
 *
 * Reveal is not here — it lives on the scene itself, where the sculpture is
 * (spec §11). Everything that remains is either the one thing you type or a
 * quiet action you take afterwards, so the interface stops competing with the
 * thing it is presenting.
 */
export function ControlPanel(props: ControlPanelProps) {
  const [shareCopied, setShareCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const scanReady = props.phase === 'scan-ready';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmitUrl();
  };

  const flash = (setter: (value: boolean) => void) => {
    setter(true);
    window.setTimeout(() => setter(false), 2400);
  };

  const handleShare = () => {
    props.onShare();
    flash(setShareCopied);
  };

  const handleEmbed = () => {
    props.onEmbed();
    flash(setEmbedCopied);
  };

  const actions = (
    <div className="card-actions">
      <IconButton
        icon={shareCopied ? 'check' : 'share'}
        label={shareCopied ? 'Link copied' : 'Share'}
        onClick={handleShare}
      />
      <IconButton
        icon={embedCopied ? 'check' : 'embed'}
        label={embedCopied ? 'Code copied' : 'Embed'}
        onClick={handleEmbed}
      />
      <IconButton icon="download" label="Save image" onClick={props.onSavePng} />
    </div>
  );

  // Scan-ready: everything but the code gets out of the way.
  if (scanReady) {
    return (
      <div className="panel panel--compact">
        <div className="panel-card">
          <p className="scan-cue">
            <strong>Scan now</strong>
            <span>Point a camera at the code.</span>
          </p>
          <span className="spacer" />
          {actions}
          <button type="button" className="button button--primary" onClick={props.onReturn}>
            Return to sculpture
          </button>
        </div>
      </div>
    );
  }

  const hintTone = props.urlError ? 'error' : props.urlIsDense ? 'warn' : 'info';
  const hintText = props.urlError
    ? props.urlError
    : props.urlIsDense
      ? 'This link is long, so the code is dense. Scan from a little closer.'
      : 'Generated in your browser. Share links carry the destination — encoded, not encrypted.';

  return (
    <div className="panel">
      <div className="panel-card">
        <form className="field" onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="destination-url">
            Destination link
          </label>
          <input
            id="destination-url"
            className="url-input"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="example.com/your-page"
            value={props.draftUrl}
            aria-invalid={props.urlError ? 'true' : 'false'}
            aria-describedby="url-hint"
            onChange={(event) => props.onDraftUrlChange(event.target.value)}
            onBlur={props.onSubmitUrl}
          />
          {/* Enter in the field commits the link. */}
          <button type="submit" className="visually-hidden">
            Update code
          </button>
        </form>
        {actions}
      </div>

      <p className="hint" id="url-hint" data-tone={hintTone}>
        {props.urlError ? (
          <span className="hint-icon" aria-hidden="true">
            ⚠
          </span>
        ) : null}
        {hintText}
      </p>

      <div className="panel-footer">
        <ChipGroup
          legend="Sculpture"
          value={props.sculpture}
          options={SCULPTURE_OPTIONS}
          onChange={props.onSculptureChange}
        />
        <ChipGroup
          legend="Theme"
          value={props.theme}
          options={THEME_OPTIONS}
          onChange={props.onThemeChange}
        />

        {props.theme === 'brand' ? (
          <div className="brand-colors">
            <label>
              Code colour
              <input
                type="color"
                value={props.brandForeground}
                onChange={(event) =>
                  props.onBrandColorsChange(event.target.value, props.brandBackground)
                }
              />
            </label>
            <label>
              Background
              <input
                type="color"
                value={props.brandBackground}
                onChange={(event) =>
                  props.onBrandColorsChange(props.brandForeground, event.target.value)
                }
              />
            </label>
            {props.contrastAdjusted ? (
              <span className="hint" data-tone="warn">
                Adjusted for contrast so the code still scans.
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
