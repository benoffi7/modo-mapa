// Cross-cutting guard tests. These complement the grep-based scripts/guards/
// by enforcing invariants that are hard to express as a single grep:
//
// - FeedbackCategory union ↔ PrivacyPolicy.tsx mentions every literal.
// - mediaType union ↔ PrivacyPolicy.tsx mentions every literal.
// - helpGroups.tsx ids ↔ features.md has a header / mention for each.
//
// These tests run as part of `npm run test:run` and CI, blocking PRs that
// drift one side without the other.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function read(relPath: string): string {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

function extractStringUnion(typeSource: string, typeName: string): string[] {
  // Matches `export type Foo = 'a' | 'b' | 'c';` (and multi-line variants).
  const pattern = new RegExp(`type\\s+${typeName}\\s*=\\s*([^;]+);`, 's');
  const match = typeSource.match(pattern);
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

function extractFieldUnion(typeSource: string, fieldName: string): string[] {
  // Matches `mediaType?: 'image' | 'pdf';` inside an interface.
  const pattern = new RegExp(`${fieldName}\\??:\\s*([^;\\n]+)[;\\n]`);
  const match = typeSource.match(pattern);
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

// Known regressions tracked in open issues. When the issue lands, the test
// passes and `it.fails` flips red — forcing the implementer to remove the entry.
// This keeps the convergence-to-zero invariant alive without blocking unrelated PRs.
const KNOWN_REGRESSIONS_TO_REMOVE: Record<string, string> = {
  'feedback-category-bug': '#329',
  'feedback-mediaType-pdf': '#329',
};

describe('Privacy policy ↔ FeedbackCategory union', () => {
  const feedbackTypes = read('src/types/feedback.ts');
  const privacyPolicy = read('src/components/profile/PrivacyPolicy.tsx').toLowerCase();
  const categories = extractStringUnion(feedbackTypes, 'FeedbackCategory');

  it('extracts the union (sanity check)', () => {
    expect(categories.length).toBeGreaterThanOrEqual(3);
  });

  // Map of union literal → list of acceptable mentions in the policy text.
  // Adding a new category here forces the policy to mention it (or alias).
  const aliases: Record<string, string[]> = {
    bug: ['bug', 'reporte de bug', 'reporte de error'],
    sugerencia: ['sugerencia', 'sugerencias'],
    datos_usuario: ['datos de usuario', 'datos del usuario', 'mis datos'],
    datos_comercio: ['datos de comercio', 'datos del comercio'],
    otro: ['otro', 'otros', 'otras'],
  };

  for (const cat of categories) {
    const regressionKey = `feedback-category-${cat}`;
    const tracked = KNOWN_REGRESSIONS_TO_REMOVE[regressionKey];
    const runner = tracked ? it.fails : it;
    const suffix = tracked ? ` (tracked: ${tracked})` : '';

    runner(`PrivacyPolicy.tsx mentions FeedbackCategory '${cat}'${suffix}`, () => {
      const candidates = aliases[cat] ?? [cat];
      const found = candidates.some((c) => privacyPolicy.includes(c.toLowerCase()));
      expect(found, `Expected one of [${candidates.join(', ')}] in PrivacyPolicy.tsx`).toBe(true);
    });
  }
});

describe('Privacy policy ↔ Feedback mediaType union', () => {
  const feedbackTypes = read('src/types/feedback.ts');
  const privacyPolicy = read('src/components/profile/PrivacyPolicy.tsx').toLowerCase();
  const mediaTypes = extractFieldUnion(feedbackTypes, 'mediaType');

  it('extracts mediaType (sanity check)', () => {
    expect(mediaTypes.length).toBeGreaterThanOrEqual(1);
  });

  const aliases: Record<string, string[]> = {
    image: ['imagen', 'imágenes', 'image'],
    pdf: ['pdf', 'documento'],
    video: ['video', 'video adjunto'],
    audio: ['audio', 'audio adjunto'],
  };

  for (const mt of mediaTypes) {
    const regressionKey = `feedback-mediaType-${mt}`;
    const tracked = KNOWN_REGRESSIONS_TO_REMOVE[regressionKey];
    const runner = tracked ? it.fails : it;
    const suffix = tracked ? ` (tracked: ${tracked})` : '';

    runner(`PrivacyPolicy.tsx mentions mediaType '${mt}'${suffix}`, () => {
      const candidates = aliases[mt] ?? [mt];
      const found = candidates.some((c) => privacyPolicy.includes(c.toLowerCase()));
      expect(found, `Expected one of [${candidates.join(', ')}] in PrivacyPolicy.tsx`).toBe(true);
    });
  }
});

describe('helpGroups.tsx ↔ features.md coverage', () => {
  const helpGroups = read('src/components/profile/helpGroups.tsx');
  const featuresMd = read('docs/reference/features.md').toLowerCase();
  const ids = Array.from(helpGroups.matchAll(/id:\s*'([a-z_-]+)'/g)).map((m) => m[1]);

  it('extracts at least 5 help group ids (sanity)', () => {
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  // Map slug → list of acceptable variants in features.md.
  // Adding a new help group here forces a features.md entry.
  const aliases: Record<string, string[]> = {
    inicio: ['inicio', 'home', 'pantalla principal'],
    primeros_pasos: ['primeros pasos', 'onboarding', 'onboarding flow'],
    buscar: ['buscar', 'búsqueda', 'search'],
    comercio: ['comercio', 'business', 'detalle de comercio'],
    checkin: ['check-in', 'checkin', 'check in'],
    offline: ['offline', 'modo offline', 'sin conexión'],
    rankings: ['rankings', 'ranking'],
    perfil_publico: ['perfil público', 'perfil publico', 'public profile'],
    recomendaciones: ['recomendaciones', 'recomendar'],
    colaborativas: ['colaborativas', 'colaborativa', 'editores', 'shared lists'],
    perfil: ['perfil', 'mi perfil'],
    logros: ['logros', 'achievements'],
    cuenta: ['cuenta', 'account', 'email auth'],
    onboarding: ['onboarding'],
    configuracion: ['configuración', 'configuracion', 'ajustes', 'settings'],
    modooscuro: ['modo oscuro', 'modooscuro', 'dark mode'],
    feedback: ['feedback'],
    listas: ['listas', 'favoritos', 'lists'],
    social: ['social', 'feed social', 'actividad'],
    notificaciones: ['notificaciones', 'notifications'],
  };

  for (const id of ids) {
    it(`features.md mentions help group '${id}'`, () => {
      const candidates = aliases[id] ?? [id, id.replace(/_/g, ' ')];
      const found = candidates.some((c) => featuresMd.includes(c.toLowerCase()));
      expect(found, `Expected features.md to mention one of [${candidates.join(', ')}]`).toBe(true);
    });
  }
});

describe('Analytics events ↔ GA4_EVENT_NAMES coverage', () => {
  // Stub: detection of orphan EVT_* constants belongs to admin-metrics-auditor agent.
  // We keep this as a placeholder so future orphan-event tests live alongside.
  it('placeholder — see admin-metrics-auditor agent for full audit', () => {
    expect(true).toBe(true);
  });
});
