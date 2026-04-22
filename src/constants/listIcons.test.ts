import { describe, it, expect } from 'vitest';
import { getListIconById, LIST_ICON_OPTIONS } from './listIcons';

describe('getListIconById', () => {
  it('returns undefined when id is undefined', () => {
    expect(getListIconById(undefined)).toBeUndefined();
  });

  it('returns undefined when id is empty string', () => {
    expect(getListIconById('')).toBeUndefined();
  });

  it('returns undefined for unknown id', () => {
    expect(getListIconById('nonexistent-icon')).toBeUndefined();
  });

  it('returns the correct icon for a valid id', () => {
    const result = getListIconById('food');
    expect(result).toEqual({ id: 'food', label: 'Comida', emoji: '🍽️' });
  });

  it('returns undefined for non-string id types', () => {
    // Testing the typeof check
    expect(getListIconById(42 as unknown as string)).toBeUndefined();
  });

  it('LIST_ICON_OPTIONS contains expected icons', () => {
    expect(LIST_ICON_OPTIONS.length).toBeGreaterThan(0);
    const ids = LIST_ICON_OPTIONS.map((i) => i.id);
    expect(ids).toContain('food');
    expect(ids).toContain('coffee');
  });
});
