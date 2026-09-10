import { useId } from 'react';
import type { CSSProperties } from 'react';

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
  /**
   * Wrap onto as many lines as the options need, rather than scrolling
   * sideways. For a group in a narrow column, where a row that runs off the
   * edge has nowhere useful to go.
   */
  wrap?: boolean;
  /**
   * Lay the chips out in this many equal columns instead of letting them wrap
   * where they fall. For a small set of peers — four shapes — where an
   * uneven break reads as a mistake rather than as a layout.
   */
  columns?: number;
}

/**
 * A radio group rendered as chips.
 *
 * Selection is communicated by `aria-checked` and by a check glyph, never by
 * colour alone, and the whole group is reachable with arrow keys through native
 * radio semantics — which is also the escape hatch that keeps a row of chips
 * usable however it is laid out.
 */
export function ChipGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
  disabled = false,
  wrap = false,
  columns,
}: ChipGroupProps<T>) {
  const groupId = useId();

  return (
    <fieldset className="option-group" disabled={disabled}>
      <legend className="option-legend">{legend}</legend>
      <div
        className="chips"
        data-wrap={wrap || columns ? 'true' : 'false'}
        role="radiogroup"
        aria-label={legend}
        {...(columns ? { style: { '--chip-columns': columns } as CSSProperties } : {})}
        data-columns={columns ? 'true' : 'false'}
      >
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
