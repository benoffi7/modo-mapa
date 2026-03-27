/**
 * Calcula la luminancia relativa de un color hex segun WCAG 2.0.
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Devuelve '#fff' o '#000' segun el contraste del fondo.
 * Usa el threshold de luminance (0.179) para decidir.
 * Equivalente simplificado de theme.palette.getContrastText() pero sin depender del theme.
 */
export function getContrastText(backgroundHex: string): '#fff' | '#000' {
  return relativeLuminance(backgroundHex) > 0.179 ? '#000' : '#fff';
}
