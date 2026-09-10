import { PAYLOAD_TYPES } from '../../qr/payloads';
import type { PayloadDraft, PayloadField, PayloadKind } from '../../qr/payloads';

export interface PayloadFieldsProps {
  kind: PayloadKind;
  draft: PayloadDraft;
  onChange: (key: string, value: string) => void;
  onCommit: () => void;
  /** Render only the fields that are not already shown in the main card. */
  skipPrimary?: boolean;
  idPrefix: string;
}

/**
 * The fields a payload kind needs, rendered from its own description.
 *
 * There is no per-kind form component. Each kind declares its fields in
 * `payloads.ts` next to the encoder that consumes them, so adding a kind is one
 * entry in one file rather than a form here, an encoder there, and a validator
 * somewhere else that quietly disagrees with both.
 */
export function PayloadFields({
  kind,
  draft,
  onChange,
  onCommit,
  skipPrimary = false,
  idPrefix,
}: PayloadFieldsProps) {
  const type = PAYLOAD_TYPES[kind];
  const fields = skipPrimary
    ? type.fields.filter((field) => field.key !== type.primary)
    : type.fields;

  if (fields.length === 0) return null;

  return (
    <div className="payload-fields">
      {fields.map((field) => (
        <Field
          key={field.key}
          field={field}
          id={`${idPrefix}-${field.key}`}
          value={draft[field.key] ?? ''}
          onChange={(value) => onChange(field.key, value)}
          onCommit={onCommit}
        />
      ))}
    </div>
  );
}

interface FieldProps {
  field: PayloadField;
  id: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

function Field({ field, id, value, onChange, onCommit }: FieldProps) {
  const label = (
    <label className="field-label" htmlFor={id}>
      {field.label}
      {field.optional ? <span className="field-optional"> — optional</span> : null}
    </label>
  );

  if (field.control === 'checkbox') {
    return (
      <div className="field-row field-row--check">
        <input
          id={id}
          type="checkbox"
          checked={value === '1'}
          onChange={(event) => {
            onChange(event.target.checked ? '1' : '');
            onCommit();
          }}
        />
        <label className="field-label" htmlFor={id}>
          {field.label}
        </label>
      </div>
    );
  }

  if (field.control === 'select') {
    return (
      <div className="field-row">
        {label}
        <select
          id={id}
          className="field-control"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onCommit();
          }}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.control === 'textarea') {
    return (
      <div className="field-row">
        {label}
        <textarea
          id={id}
          className="field-control"
          rows={3}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
        />
      </div>
    );
  }

  return (
    <div className="field-row">
      {label}
      <input
        id={id}
        className="field-control"
        type="text"
        inputMode={field.inputMode}
        spellCheck={false}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onCommit();
        }}
      />
    </div>
  );
}
