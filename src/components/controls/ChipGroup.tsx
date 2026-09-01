import { useId } from 'react';

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

export interface ChipGroupProps<T extends string> {
  legend: string;
  value: T;
  options: readonly ChipOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * A radio group rendered as chips.
 *
 * Selection is communicated by `aria-checked` and by a check glyph, never by
 * colour alone, and the whole group is reachable with arrow keys through native
 * radio semantics.
 */
export function ChipGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
  disabled = false,
}: ChipGroupProps<T>) {
  const groupId = useId();

  return (
    <fieldset className="option-group" disabled={disabled}>
      <legend className="option-legend">{legend}</legend>
      <div className="chips" role="radiogroup" aria-label={legend}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            id={`${groupId}-${option.id}`}
            className="chip"
            aria-checked={option.id === value}
            aria-describedby={option.hint ? `${groupId}-${option.id}-hint` : undefined}
            tabIndex={option.id === value ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const index = options.findIndex((candidate) => candidate.id === value);
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % options.length
                  : (index - 1 + options.length) % options.length;
              const target = options[next];
              if (!target) return;
              onChange(target.id);
              document.getElementById(`${groupId}-${target.id}`)?.focus();
            }}
          >
            {option.label}
            {option.hint ? (
              <span className="visually-hidden" id={`${groupId}-${option.id}-hint`}>
                {option.hint}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
