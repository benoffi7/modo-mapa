import { describe, it, expect } from 'vitest';
import { HELP_GROUPS } from '../helpGroups';
import { AVATAR_OPTIONS } from '../../../constants/avatars';

describe('HELP_GROUPS', () => {
  it('no esta vacio', () => {
    expect(HELP_GROUPS.length).toBeGreaterThan(0);
  });

  it('cada grupo tiene al menos un item', () => {
    for (const group of HELP_GROUPS) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('todos los ids de items son unicos a nivel global', () => {
    const ids = HELP_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('cada item tiene title y description no vacios', () => {
    for (const group of HELP_GROUPS) {
      for (const item of group.items) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('cada item tiene un icono ReactElement', () => {
    for (const group of HELP_GROUPS) {
      for (const item of group.items) {
        expect(item.icon).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((item.icon as any).type).toBeDefined();
      }
    }
  });

  it('contiene items clave de features recientes', () => {
    const ids = HELP_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toContain('offline'); // #136
    expect(ids).toContain('rankings'); // #200
    expect(ids).toContain('perfil_publico'); // perfil publico de otros usuarios
  });

  it('item "perfil" cita el count real de AVATAR_OPTIONS', () => {
    const perfilItem = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'perfil');
    expect(perfilItem).toBeDefined();
    expect(perfilItem?.description).toContain(`${AVATAR_OPTIONS.length} opciones`);
  });

  it('item "modooscuro" menciona Configuracion > Apariencia (no menu lateral)', () => {
    const darkItem = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'modooscuro');
    expect(darkItem).toBeDefined();
    expect(darkItem?.description).toMatch(/Configuracion\s*>\s*Apariencia/i);
    expect(darkItem?.description.toLowerCase()).not.toContain('menu lateral');
  });

  it('item "comercio" aclara que 20/dia es compartido entre comentarios y preguntas', () => {
    const comercioItem = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'comercio');
    expect(comercioItem).toBeDefined();
    expect(comercioItem?.description.toLowerCase()).toContain('compartido');
  });
});
