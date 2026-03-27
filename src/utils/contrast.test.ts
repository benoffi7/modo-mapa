import { relativeLuminance, getContrastText } from './contrast';

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
