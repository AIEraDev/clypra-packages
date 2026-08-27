import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClypraColorPicker } from '../components/ClypraColorPicker';

describe('Floating UI positioning support in ClypraColorPicker', () => {
  it('defaults to bottom-start placement and populates data attributes', () => {
    render(<ClypraColorPicker defaultValue="#8B5CF6" />);
    const trigger = screen.getByRole('button', { name: /Choose color/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('data-placement')).toBe('bottom-start');
    expect(dialog.getAttribute('data-side')).toBe('bottom');
    expect(dialog.getAttribute('data-align')).toBe('start');
  });

  it('supports explicit placement prop (e.g. top-end)', () => {
    render(<ClypraColorPicker defaultValue="#3B82F6" placement="top-end" />);
    const trigger = screen.getByRole('button', { name: /Choose color/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('data-placement')).toBe('top-end');
    expect(dialog.getAttribute('data-side')).toBe('top');
    expect(dialog.getAttribute('data-align')).toBe('end');
  });

  it('supports position prop as alias for placement (e.g. left-start)', () => {
    render(<ClypraColorPicker defaultValue="#10B981" position="left-start" />);
    const trigger = screen.getByRole('button', { name: /Choose color/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('data-placement')).toBe('left-start');
    expect(dialog.getAttribute('data-side')).toBe('left');
    expect(dialog.getAttribute('data-align')).toBe('start');
  });

  it('supports all 12 standard Floating UI placements', () => {
    const placements = [
      'top', 'top-start', 'top-end',
      'right', 'right-start', 'right-end',
      'bottom', 'bottom-start', 'bottom-end',
      'left', 'left-start', 'left-end',
    ] as const;

    for (const p of placements) {
      const { unmount } = render(
        <ClypraColorPicker defaultValue="#EC4899" placement={p} label={`Picker ${p}`} />
      );
      const trigger = screen.getByRole('button', { name: new RegExp(`Picker ${p}`, 'i') });
      fireEvent.click(trigger);

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('data-placement')).toBe(p);
      unmount();
    }
  });

  it('accepts custom offset, flip, shift, strategy and autoUpdate options', () => {
    render(
      <ClypraColorPicker
        defaultValue="#F59E0B"
        placement="bottom-end"
        offset={{ mainAxis: 12, crossAxis: 4 }}
        flip={{ padding: 10 }}
        shift={{ padding: 12 }}
        strategy="fixed"
        autoUpdate={true}
      />
    );
    const trigger = screen.getByRole('button', { name: /Choose color/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('data-placement')).toBe('bottom-end');
  });
});
