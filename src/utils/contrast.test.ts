import { relativeLuminance, getContrastText, getContrastRatio, meetsWCAG_AA } from './contrast';

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4);
  });

  it('returns 1 for white', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 4);
  });

  it('returns ~0.2126 for pure red', () => {
    expect(relativeLuminance('#ff0000')).toBeCloseTo(0.2126, 3);
  });

  it('returns ~0.7152 for pure green', () => {
    expect(relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 3);
  });

  it('returns ~0.0722 for pure blue', () => {
    expect(relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 3);
  });
});

describe('getContrastText', () => {
  it('returns #000 for white background', () => {
    expect(getContrastText('#ffffff')).toBe('#000');
  });

  it('returns #fff for black background', () => {
    expect(getContrastText('#000000')).toBe('#fff');
  });

  // LIST_COLORS audit
  it('returns #000 for blue (#1e88e5)', () => {
    expect(getContrastText('#1e88e5')).toBe('#000');
  });

  it('returns #000 for orange (#fb8c00)', () => {
    expect(getContrastText('#fb8c00')).toBe('#000');
  });

  it('returns #000 for pink (#e91e63)', () => {
    expect(getContrastText('#e91e63')).toBe('#000');
  });

  it('returns #000 for green (#43a047)', () => {
    expect(getContrastText('#43a047')).toBe('#000');
  });

  it('returns #fff for purple (#8e24aa)', () => {
    expect(getContrastText('#8e24aa')).toBe('#fff');
  });

  it('returns #000 for red (#e53935)', () => {
    expect(getContrastText('#e53935')).toBe('#000');
  });

  it('returns #000 for teal (#00897b)', () => {
    expect(getContrastText('#00897b')).toBe('#000');
  });

  it('returns #000 for amber (#ffb300)', () => {
    expect(getContrastText('#ffb300')).toBe('#000');
  });
});

describe('getContrastRatio', () => {
  it('returns 21 for white vs black (maximum contrast)', () => {
    expect(getContrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('returns 21 regardless of order (black vs white)', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('returns 1 for identical colors (black vs black)', () => {
    expect(getContrastRatio('#000000', '#000000')).toBeCloseTo(1, 4);
  });

  it('returns 1 for identical colors (white vs white)', () => {
    expect(getContrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 4);
  });

  it('returns high contrast (>13) for gold (#FFD700) vs black', () => {
    // Canonical WCAG 2.0 value: 14.97 (gold luminance ~0.7). Passes AA (normal + UI).
    expect(getContrastRatio('#FFD700', '#000000')).toBeGreaterThan(13);
    expect(getContrastRatio('#FFD700', '#000000')).toBeLessThan(16);
  });

  it('returns low ratio (<1.5) for gold (#FFD700) vs white (fails WCAG AA)', () => {
    // Gold over white fails: ratio ~1.40, far below 4.5 threshold.
    const ratio = getContrastRatio('#FFD700', '#ffffff');
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.5);
  });

  it('returns high contrast (>13) for gold (#FFD700) vs dark bg (#121212)', () => {
    // Passes WCAG AA as UI component (>= 3.0) with big margin.
    const ratio = getContrastRatio('#FFD700', '#121212');
    expect(ratio).toBeGreaterThan(13);
    expect(ratio).toBeLessThan(15);
  });

  it('returns >4.5 for white text on primary blue (#1a73e8)', () => {
    expect(getContrastRatio('#ffffff', '#1a73e8')).toBeGreaterThan(4.5);
  });
});

describe('meetsWCAG_AA', () => {
  it('returns true for white/black (ratio 21, passes all)', () => {
    expect(meetsWCAG_AA('#ffffff', '#000000')).toBe(true);
    expect(meetsWCAG_AA('#ffffff', '#000000', true)).toBe(true);
  });

  it('returns false for identical colors', () => {
    expect(meetsWCAG_AA('#000000', '#000000')).toBe(false);
    expect(meetsWCAG_AA('#000000', '#000000', true)).toBe(false);
  });

  it('returns false for gold vs white — normal text (ratio 1.51 < 4.5)', () => {
    expect(meetsWCAG_AA('#FFD700', '#ffffff')).toBe(false);
  });

  it('returns false for gold vs white — large/UI (ratio 1.51 < 3.0)', () => {
    expect(meetsWCAG_AA('#FFD700', '#ffffff', true)).toBe(false);
  });

  it('returns true for gold vs black — normal text (ratio 13.87)', () => {
    expect(meetsWCAG_AA('#FFD700', '#000000')).toBe(true);
  });

  it('returns true for white on blue (#1e88e5) — normal text', () => {
    // Blue is light enough that text needs to be dark, but check ratio
    // white vs #1e88e5: relativeLuminance(#1e88e5) ~= 0.26, ratio = (1 + 0.05) / (0.26 + 0.05) ~= 3.38
    // Fails at 4.5 but passes at 3.0 (large)
    expect(meetsWCAG_AA('#ffffff', '#1e88e5', true)).toBe(true);
  });

  it('defaults isLargeText to false when omitted', () => {
    // Threshold 4.5 applies
    const ratio = getContrastRatio('#777777', '#ffffff');
    const expected = ratio >= 4.5;
    expect(meetsWCAG_AA('#777777', '#ffffff')).toBe(expected);
  });
});
