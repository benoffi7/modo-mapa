import { describe, it, expect } from 'vitest';
import { HOME_SECTIONS } from '../homeSections';

describe('HOME_SECTIONS', () => {
  it('has unique IDs', () => {
    const ids = HOME_SECTIONS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every section has a defined component', () => {
    for (const section of HOME_SECTIONS) {
      expect(section.component).toBeDefined();
    }
  });

  it('contains all 8 expected sections', () => {
    expect(HOME_SECTIONS).toHaveLength(8);
    const ids = HOME_SECTIONS.map((s) => s.id);
    expect(ids).toEqual([
      'greeting',
      'quick-actions',
      'specials',
      'trending-near',
      'interests',
      'recent-searches',
      'for-you',
      'digest',
    ]);
  });
});
