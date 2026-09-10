import { useEffect, useRef } from 'react';
import { ChipGroup } from './ChipGroup';
import { PayloadFields } from './PayloadFields';
import { PAYLOAD_KINDS, PAYLOAD_TYPES } from '../../qr/payloads';
import type { PayloadDraft, PayloadKind } from '../../qr/payloads';
import { CORNER_SHAPES, MODULE_SHAPES } from '../../qr/shapes';
import type { ShapeId } from '../../qr/shapes';
import { LOGO_ACCEPT } from '../../qr/logo';

export interface ConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  payloadKind: PayloadKind;
  draft: PayloadDraft;
  moduleShape: ShapeId;
  cornerShape: ShapeId;
  logo: string | null;
  onPayloadKindChange: (kind: PayloadKind) => void;
  onDraftFieldChange: (key: string, value: string) => void;
  onCommit: () => void;
  onModuleShapeChange: (shape: ShapeId) => void;
  onCornerShapeChange: (shape: ShapeId) => void;
  onLogoFile: (file: File) => void;
  onLogoClear: () => void;
}

const KIND_OPTIONS = PAYLOAD_KINDS.map((id) => ({
  id,
  label: PAYLOAD_TYPES[id].label,
  hint: PAYLOAD_TYPES[id].hint,
}));

const SHAPE_OPTIONS = MODULE_SHAPES.map(({ id, label, hint }) => ({ id, label, hint }));
const CORNER_OPTIONS = CORNER_SHAPES.map(({ id, label, hint }) => ({ id, label, hint }));

/**
 * Everything the code *is*, in one panel off to the side.
 *
 * The bottom card holds the one thing you type. This holds the decisions you
 * make once and then stop thinking about — what kind of thing the code carries,
 * what its modules look like, whether it has a logo — which is why they belong
 * behind a door rather than in front of the sculpture.
 */
export function ConfigDrawer(props: ConfigDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { open, onClose } = props;

  // Escape closes it, so the drawer behaves like the dialog it is rather than a
  // div that happens to be on top.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  /**
   * Focus moves into the panel once, when it opens.
   *
   * Deliberately its own effect keyed on `open` alone. Depending on the whole
   * props object — which is a new object every render, and this drawer
   * re-renders on every keystroke it collects — would re-run the focus call
   * mid-typing and pull the caret out of the field being filled in.
   */
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="drawer-scrim"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="false"
        aria-label="Code settings"
        tabIndex={-1}
        data-testid="config-drawer"
      >
        <div className="drawer-head">
          <h2 className="drawer-title">Code settings</h2>
          <button type="button" className="drawer-close" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="drawer-body">
          <section className="drawer-section">
            <ChipGroup
              legend="Type"
              value={props.payloadKind}
              options={KIND_OPTIONS}
              onChange={props.onPayloadKindChange}
            />
            <PayloadFields
              kind={props.payloadKind}
              draft={props.draft}
              onChange={props.onDraftFieldChange}
              onCommit={props.onCommit}
              idPrefix="drawer"
            />
          </section>

          <section className="drawer-section">
            <ChipGroup
              legend="Modules"
              value={props.moduleShape}
              options={SHAPE_OPTIONS}
              onChange={props.onModuleShapeChange}
            />
            <ChipGroup
              legend="Corners"
              value={props.cornerShape}
              options={CORNER_OPTIONS}
              onChange={props.onCornerShapeChange}
            />
            <p className="drawer-note">
              Shapes apply to the voxels and to the finished code alike. Dots use stronger error
              correction, so the code gets a little denser.
            </p>
          </section>

          <section className="drawer-section">
            <h3 className="drawer-subtitle">Centre logo</h3>
            <div className="logo-row">
              {props.logo ? (
                <img className="logo-preview" src={props.logo} alt="Current centre logo" />
              ) : (
                <span className="logo-empty" aria-hidden="true" />
              )}
              <div className="logo-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => fileRef.current?.click()}
                >
                  {props.logo ? 'Replace' : 'Add a logo'}
                </button>
                {props.logo ? (
                  <button type="button" className="ghost-button" onClick={props.onLogoClear}>
                    Remove
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                className="visually-hidden"
                type="file"
                accept={LOGO_ACCEPT}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) props.onLogoFile(file);
                  event.target.value = '';
                }}
              />
            </div>
            <p className="drawer-note">
              A logo covers part of the code, so adding one switches to the strongest error
              correction. It stays on this device — a shared link carries the code, not the picture.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
