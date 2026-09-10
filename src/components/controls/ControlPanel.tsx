import type { FormEvent } from 'react';
import { ChipGroup } from './ChipGroup';
import { ScanCue } from './ScanCue';
import { ShareActions } from './ShareActions';
import { PAYLOAD_TYPES } from '../../qr/payloads';
import type { PayloadDraft, PayloadKind } from '../../qr/payloads';
import { CUSTOM_SCULPTURE, SCULPTURES } from '../../voxel/types';
import type { ActiveSculptureId } from '../../voxel/types';
import { THEME_IDS, THEMES } from '../../themes/themes';
import type { ThemeId } from '../../themes/themes';
import type { Phase } from '../../app/experience-store';

export interface ControlPanelProps {
  payloadKind: PayloadKind;
  draft: PayloadDraft;
  valueError: string | null;
  valueIsDense: boolean;
  sculpture: ActiveSculptureId;
  /** Label for the uploaded sculpture, when there is one. */
  customSculptureName: string | null;
  theme: ThemeId;
  phase: Phase;
  onDraftFieldChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onSculptureChange: (value: ActiveSculptureId) => void;
  onThemeChange: (value: ThemeId) => void;
  onShare: () => void;
  onEmbed: () => void;
  onSavePng: () => void;
}

const SCULPTURE_OPTIONS: ReadonlyArray<{ id: ActiveSculptureId; label: string; hint: string }> =
  SCULPTURES.map((sculpture) => ({
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
 * The bottom stack: a card holding the code's headline field and its three icon
 * actions, with the sculpture and theme pickers as a footer beneath it.
 *
 * The field shown is whichever one *names* the current kind — the link, the
 * network, the person. Everything else a kind needs lives in the settings
 * drawer, so the card stays one line whether the code carries a URL or a whole
 * contact card, and the sculpture keeps the screen.
 *
 * Reveal is not here — it lives on the scene itself, where the sculpture is
 * (spec §11).
 */
export function ControlPanel(props: ControlPanelProps) {
  const scanReady = props.phase === 'scan-ready';
  const type = PAYLOAD_TYPES[props.payloadKind];
  const primary = type.fields.find((field) => field.key === type.primary) ?? type.fields[0];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit();
  };

  const actions = (
    <ShareActions onShare={props.onShare} onEmbed={props.onEmbed} onSavePng={props.onSavePng} />
  );

  // Scan-ready: everything but the code gets out of the way.
  //
  // There is no "Return to sculpture" button here any more. Pressing the code
  // takes you back — the same gesture that revealed it — which is both fewer
  // things to find and the fix for a real bug: on a 390px phone the button's
  // 185px pushed the row 41px past the edge of the screen, so the one control
  // that got you out of scan mode was partly untappable.
  if (scanReady) {
    return (
      <div className="panel panel--compact">
        <div className="panel-card">
          <ScanCue />
          <span className="spacer" />
          {actions}
        </div>
      </div>
    );
  }

  /**
   * The hint line speaks only when it has something to say.
   *
   * It used to carry a standing note about local generation and share-link
   * privacy. That is worth disclosing, but not worth a permanent line of text
   * under the field — so the disclosure moved to the moment it matters: the
   * Share button's tooltip, and the announcement made when a link is copied.
   */
  const hintText = props.valueError
    ? props.valueError
    : props.valueIsDense
      ? 'This one is long, so the code is dense. Scan from a little closer.'
      : null;
  const hintTone = props.valueError ? 'error' : 'warn';

  const extras = type.fields.length - 1;

  // The uploaded sculpture joins the picker only once there is one, and it goes
  // first: it is the one nobody else has.
  const sculptureOptions = props.customSculptureName
    ? [
        {
          id: CUSTOM_SCULPTURE as ActiveSculptureId,
          label: 'Yours',
          hint: `Built from ${props.customSculptureName}`,
        },
        ...SCULPTURE_OPTIONS,
      ]
    : SCULPTURE_OPTIONS;

  return (
    <div className="panel">
      <div className="panel-card">
        <form className="field" onSubmit={handleSubmit} noValidate>
          {/* The placeholder says what this is; the label is kept for screen
              readers rather than spending a line of the card on it. */}
          <label className="visually-hidden" htmlFor="payload-primary">
            {primary?.label ?? 'Destination link'}
          </label>
          <input
            id="payload-primary"
            className="url-input"
            type="text"
            inputMode={primary?.inputMode}
            spellCheck={false}
            maxLength={primary?.maxLength}
            placeholder={
              props.payloadKind === 'url'
                ? 'Paste a link — example.com/your-page'
                : `${primary?.label ?? ''}${primary?.placeholder ? ` — ${primary.placeholder}` : ''}`
            }
            value={props.draft[primary?.key ?? 'url'] ?? ''}
            aria-invalid={props.valueError ? 'true' : 'false'}
            {...(hintText ? { 'aria-describedby': 'url-hint' } : {})}
            onChange={(event) =>
              props.onDraftFieldChange(primary?.key ?? 'url', event.target.value)
            }
            onBlur={props.onSubmit}
            data-testid="payload-input"
          />
          {/* Enter in the field commits the code. */}
          <button type="submit" className="visually-hidden">
            Update code
          </button>
        </form>
        {actions}
      </div>

      {hintText ? (
        <p className="hint" id="url-hint" data-tone={hintTone}>
          {props.valueError ? (
            <span className="hint-icon" aria-hidden="true">
              ⚠
            </span>
          ) : null}
          {hintText}
        </p>
      ) : null}

      {/* A kind with more to say points at where the rest of it lives, rather
          than growing the card to hold six fields nobody asked to see yet. */}
      {extras > 0 ? (
        <p className="hint" data-tone="quiet">
          {type.label} details are in code settings, top right.
        </p>
      ) : null}

      <div className="panel-footer">
        <ChipGroup
          legend="Theme"
          value={props.theme}
          options={THEME_OPTIONS}
          onChange={props.onThemeChange}
        />
        <ChipGroup
          legend="Sculpture"
          value={props.sculpture}
          options={sculptureOptions}
          onChange={props.onSculptureChange}
        />
      </div>
    </div>
  );
}
