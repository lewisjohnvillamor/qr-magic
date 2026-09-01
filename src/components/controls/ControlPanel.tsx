import { useState } from 'react';
import type { FormEvent } from 'react';
import { ChipGroup } from './ChipGroup';
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
  muted: boolean;
  contrastAdjusted: boolean;
  onDraftUrlChange: (value: string) => void;
  onSubmitUrl: () => void;
  onSculptureChange: (value: SculptureId) => void;
  onThemeChange: (value: ThemeId) => void;
  onBrandColorsChange: (foreground: string, background: string) => void;
  onReveal: () => void;
  onReturn: () => void;
  onShare: () => void;
  onEmbed: () => void;
  onToggleMute: () => void;
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
 * Every product action, reachable without touching the canvas (spec §16).
 *
 * One column, generous rhythm: link first, the two pickers as full-width rows
 * with their scrollbars hidden behind edge fades, quiet secondary actions
 * last. On small screens the panel becomes a bottom sheet.
 */
export function ControlPanel(props: ControlPanelProps) {
  const [shareLabel, setShareLabel] = useState('Share');
  const [embedLabel, setEmbedLabel] = useState('Embed');
  const scanReady = props.phase === 'scan-ready';
  const busy = props.phase === 'revealing' || props.phase === 'returning';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmitUrl();
  };

  const handleShare = () => {
    props.onShare();
    setShareLabel('Link copied');
    window.setTimeout(() => setShareLabel('Share'), 2400);
  };

  const handleEmbed = () => {
    props.onEmbed();
    setEmbedLabel('Code copied');
    window.setTimeout(() => setEmbedLabel('Embed'), 2400);
  };

  const soundButton = (
    <button
      type="button"
      className="button button--quiet"
      onClick={props.onToggleMute}
      aria-pressed={!props.muted}
    >
      {props.muted ? 'Sound off' : 'Sound on'}
    </button>
  );

  // Scan-ready: the panel collapses to a single row so the code owns the screen.
  if (scanReady) {
    return (
      <div className="panel panel--compact">
        <div className="panel-inner">
          <div className="actions">
            <p className="scan-cue">
              <strong>Scan now</strong>
              <span>Point a camera at the code.</span>
            </p>
            <span className="spacer" />
            {soundButton}
            <button type="button" className="button" onClick={handleShare}>
              {shareLabel}
            </button>
            <button type="button" className="button button--primary" onClick={props.onReturn}>
              Return to sculpture
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hintTone = props.urlError ? 'error' : props.urlIsDense ? 'warn' : 'info';
  const hintText = props.urlError
    ? props.urlError
    : props.urlIsDense
      ? 'This link is long, so the code is dense. Scan from a little closer.'
      : 'Your link never leaves this browser — the code is generated locally.';

  return (
    <div className="panel">
      <div className="panel-inner">
        <form className="field" onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="destination-url">
            Destination link
          </label>
          <div className="field-row">
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
            <button
              type="button"
              className="button button--primary"
              onClick={props.onReveal}
              disabled={busy || Boolean(props.urlError)}
              data-testid="reveal-button"
            >
              Reveal QR
            </button>
          </div>
          <p className="hint" id="url-hint" data-tone={hintTone}>
            {props.urlError ? (
              <span className="hint-icon" aria-hidden="true">
                ⚠
              </span>
            ) : null}
            {hintText}
          </p>
          {/* Enter in the field submits the form and re-generates the code. */}
          <button type="submit" className="visually-hidden">
            Update code
          </button>
        </form>

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

        <div className="actions">
          <p className="privacy-note">
            Share links carry your destination — encoded, not encrypted.
          </p>
          <span className="spacer" />
          {soundButton}
          <button type="button" className="button button--quiet" onClick={handleEmbed}>
            {embedLabel}
          </button>
          <button type="button" className="button" onClick={handleShare}>
            {shareLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
