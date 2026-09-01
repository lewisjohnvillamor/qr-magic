import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlPanel } from '../../src/components/controls/ControlPanel';
import type { ControlPanelProps } from '../../src/components/controls/ControlPanel';

function setup(overrides: Partial<ControlPanelProps> = {}) {
  const props: ControlPanelProps = {
    draftUrl: 'https://example.com/',
    urlError: null,
    urlIsDense: false,
    sculpture: 'crystal',
    theme: 'nature',
    brandForeground: '#111111',
    brandBackground: '#f7f4ec',
    phase: 'sculpture',
    muted: true,
    contrastAdjusted: false,
    onDraftUrlChange: vi.fn(),
    onSubmitUrl: vi.fn(),
    onSculptureChange: vi.fn(),
    onThemeChange: vi.fn(),
    onBrandColorsChange: vi.fn(),
    onReveal: vi.fn(),
    onReturn: vi.fn(),
    onShare: vi.fn(),
    onEmbed: vi.fn(),
    onToggleMute: vi.fn(),
    ...overrides,
  };
  render(<ControlPanel {...props} />);
  return props;
}

describe('ControlPanel', () => {
  it('exposes every action as a labelled control', () => {
    setup();
    expect(screen.getByLabelText('Destination link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reveal QR' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sound off' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Sculpture' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
  });

  it('marks the invalid field and shows the message without relying on colour', async () => {
    setup({ urlError: 'That link is missing a valid domain name.' });
    const input = screen.getByLabelText('Destination link');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('That link is missing a valid domain name.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reveal QR' })).toBeDisabled();
  });

  it('warns about dense codes', () => {
    setup({ urlIsDense: true });
    expect(screen.getByText(/code is dense/i)).toBeInTheDocument();
  });

  it('reveals from the keyboard alone', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.tab();
    await user.keyboard('{Enter}');
    // The first tab stop inside the panel is the URL field; walk to the button.
    const button = screen.getByRole('button', { name: 'Reveal QR' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(props.onReveal).toHaveBeenCalled();
  });

  it('moves between chips with the arrow keys', async () => {
    const user = userEvent.setup();
    const props = setup();
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    const checked = group.querySelector('[aria-checked="true"]') as HTMLElement;
    checked.focus();
    await user.keyboard('{ArrowRight}');
    expect(props.onThemeChange).toHaveBeenCalledWith('cyber');
    await user.keyboard('{ArrowLeft}');
    expect(props.onThemeChange).toHaveBeenLastCalledWith('brand');
  });

  it('swaps to the return action when scan-ready', () => {
    setup({ phase: 'scan-ready' });
    expect(screen.queryByRole('button', { name: 'Reveal QR' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to sculpture' })).toBeInTheDocument();
  });

  it('disables reveal while the transformation is running', () => {
    setup({ phase: 'revealing' });
    expect(screen.getByRole('button', { name: 'Reveal QR' })).toBeDisabled();
  });

  it('shows brand colour pickers only for the brand theme', async () => {
    const user = userEvent.setup();
    const props = setup({ theme: 'brand' });
    const picker = screen.getByLabelText('Code colour');
    await user.click(picker);
    expect(picker).toBeInTheDocument();
    expect(screen.getByLabelText('Background')).toBeInTheDocument();
    expect(props.onBrandColorsChange).not.toHaveBeenCalled();
  });

  it('says plainly that the share link is not encrypted', () => {
    setup();
    expect(screen.getByText(/encoded, not/i)).toBeInTheDocument();
  });

  it('confirms a share in the button label', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(props.onShare).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();
  });
});
