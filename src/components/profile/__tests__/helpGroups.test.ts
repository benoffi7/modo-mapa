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
    // Tolera tanto "Configuracion" como "Configuración" tras el copy pass de #328.
    expect(darkItem?.description).toMatch(/Configuraci[oó]n\s*>\s*Apariencia/i);
    expect(darkItem?.description.toLowerCase()).not.toContain('menu lateral');
  });

  it('item "comercio" aclara que 20/dia es compartido entre comentarios y preguntas', () => {
    const comercioItem = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'comercio');
    expect(comercioItem).toBeDefined();
    expect(comercioItem?.description.toLowerCase()).toContain('compartido');
  });

  // ============================================================
  // Casos nuevos #328 — BusinessDetailScreen + missing items
  // ============================================================

  it('item "comercio" describe las 5 secciones (chip tabs) y el deep link', () => {
    const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'comercio');
    expect(item).toBeDefined();
    // Acepta "5 chip tabs", "5 secciones", "cinco secciones", etc.
    expect(item?.description).toMatch(/(5|cinco)\s+(chip\s+tabs?|secciones)/i);
    // Deep link a la pantalla full
    expect(item?.description).toMatch(/(\/comercio\/|pantalla\s+full|Ver\s+detalles)/i);
  });

  it('item "comercio" distingue chip tabs de sub-pestañas', () => {
    const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'comercio');
    expect(item?.description).toMatch(/sub-?pestañas?/i);
  });

  it('item "buscar" menciona el auto-fallback a vista de lista', () => {
    const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'buscar');
    // Tolera "automaticamente" / "automáticamente" (con o sin tilde) y "auto-fallback".
    expect(item?.description).toMatch(/autom[áa]ticamente|auto-?fallback/i);
    expect(item?.description.toLowerCase()).toContain('lista');
  });

  it('contiene los 5 items nuevos de #328', () => {
    const ids = HELP_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toContain('sorprendeme');
    expect(ids).toContain('tus_intereses_home');
    expect(ids).toContain('tus_intereses_perfil');
    expect(ids).toContain('estadisticas');
    expect(ids).toContain('confirmacion_salir');
  });

  it('items nuevos estan en el grupo correcto', () => {
    const findGroup = (id: string) =>
      HELP_GROUPS.find((g) => g.items.some((i) => i.id === id))?.label;
    expect(findGroup('sorprendeme')).toBe('Inicio');
    expect(findGroup('tus_intereses_home')).toBe('Inicio');
    expect(findGroup('tus_intereses_perfil')).toBe('Perfil');
    expect(findGroup('estadisticas')).toBe('Perfil');
    expect(findGroup('confirmacion_salir')).toBe('Buscar');
  });

  it('item "listas" describe Recientes como historial unificado', () => {
    const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'listas');
    expect(item?.description.toLowerCase()).toContain('unificado');
    // Debe mencionar ambos origenes
    expect(item?.description).toMatch(/check-?in/i);
    expect(item?.description).toMatch(/visitad/i);
  });

  it('al menos 3 de inicio/social/listas/notificaciones mencionan pull-to-refresh', () => {
    const targets = ['inicio', 'social', 'listas', 'notificaciones'];
    const items = HELP_GROUPS.flatMap((g) => g.items).filter((i) => targets.includes(i.id));
    const withPtr = items.filter((i) =>
      /tir[áa]\s+hacia\s+abajo|tirar\s+hacia\s+abajo|refrescar/i.test(i.description),
    );
    expect(withPtr.length).toBeGreaterThanOrEqual(3);
  });
});
