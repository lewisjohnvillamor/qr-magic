import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THEME_IDS } from '../../src/themes/themes';
import { ControlPanel } from '../../src/components/controls/ControlPanel';
import type { ControlPanelProps } from '../../src/components/controls/ControlPanel';

function setup(overrides: Partial<ControlPanelProps> = {}) {
  const props: ControlPanelProps = {
    draftUrl: 'https://example.com/',
    urlError: null,
    urlIsDense: false,
    sculpture: 'crystal',
    theme: 'nature',
    phase: 'sculpture',
    onDraftUrlChange: vi.fn(),
    onSubmitUrl: vi.fn(),
    onSculptureChange: vi.fn(),
    onThemeChange: vi.fn(),
    onReturn: vi.fn(),
    onShare: vi.fn(),
    onEmbed: vi.fn(),
    onSavePng: vi.fn(),
    ...overrides,
  };
  render(<ControlPanel {...props} />);
  return props;
}

describe('ControlPanel', () => {
  it('names every icon action, so nothing depends on reading a glyph', () => {
    setup();
    expect(screen.getByLabelText('Destination link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Embed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save image' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Sculpture' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
  });

  it('marks the invalid field and shows the message without relying on colour', async () => {
    setup({ urlError: 'That link is missing a valid domain name.' });
    const input = screen.getByLabelText('Destination link');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('That link is missing a valid domain name.')).toBeInTheDocument();
  });

  it('warns about dense codes', () => {
    setup({ urlIsDense: true });
    expect(screen.getByText(/code is dense/i)).toBeInTheDocument();
  });

  it('commits the link from the keyboard alone', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByLabelText('Destination link'));
    await user.keyboard('{Enter}');
    expect(props.onSubmitUrl).toHaveBeenCalled();
  });

  it('moves between chips with the arrow keys', async () => {
    const user = userEvent.setup();
    const props = setup();
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    const checked = group.querySelector('[aria-checked="true"]') as HTMLElement;
    checked.focus();
    await user.keyboard('{ArrowRight}');
    expect(props.onThemeChange).toHaveBeenCalledWith('cyber');
    // Left from the first chip wraps to the last one in the group.
    await user.keyboard('{ArrowLeft}');
    expect(props.onThemeChange).toHaveBeenLastCalledWith(THEME_IDS[THEME_IDS.length - 1]);
  });

  it('collapses to the scan cue and its actions when scan-ready', () => {
    setup({ phase: 'scan-ready' });
    expect(screen.queryByLabelText('Destination link')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Theme' })).not.toBeInTheDocument();
    expect(screen.getByText('Scan now')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save image' })).toBeInTheDocument();
  });

  it('keeps the hint line silent until it has something to say', () => {
    setup();
    // No standing commentary under the field.
    expect(screen.queryByText(/encoded, not encrypted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/generated in your browser/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Destination link')).not.toHaveAttribute('aria-describedby');
  });

  it('describes the field only while there is a message to point at', () => {
    setup({ urlIsDense: true });
    expect(screen.getByLabelText('Destination link')).toHaveAttribute(
      'aria-describedby',
      'url-hint',
    );
    expect(screen.getByText(/code is dense/i)).toHaveAttribute('id', 'url-hint');
  });

  it('still discloses what a share link carries, on the button itself', () => {
    setup();
    const title = screen.getByRole('button', { name: 'Share' }).getAttribute('title') ?? '';
    expect(title).toMatch(/not encrypted/i);
    expect(title).toMatch(/3D sculpture/i);
  });

  it('confirms a copy in the icon button label', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(props.onShare).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Embed' }));
    expect(props.onEmbed).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Code copied' })).toBeInTheDocument();
  });
});
