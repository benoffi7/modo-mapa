import * as validation from '../constants/validation';
import * as cache from '../constants/cache';
import * as storage from '../constants/storage';
import * as map from '../constants/map';
import * as business from '../constants/business';
import * as tags from '../constants/tags';
import * as rankings from '../constants/rankings';
import * as feedback from '../constants/feedback';
import * as ui from '../constants/ui';
import * as admin from '../constants/admin';
import * as timing from '../constants/timing';

export interface ConstantEntry {
  name: string;
  value: unknown;
  type: string;
  module: string;
}

export interface ConstantModule {
  name: string;
  description: string;
  entries: ConstantEntry[];
}

function buildEntries(mod: Record<string, unknown>, moduleName: string): ConstantEntry[] {
  return Object.entries(mod).map(([name, value]) => ({
    name,
    value,
    type: Array.isArray(value) ? 'array' : typeof value,
    module: moduleName,
  }));
}

export const CONSTANT_MODULES: ConstantModule[] = [
  { name: 'validation', description: 'Límites de caracteres y valores permitidos', entries: buildEntries(validation, 'validation') },
  { name: 'cache', description: 'TTLs de cache', entries: buildEntries(cache, 'cache') },
  { name: 'storage', description: 'Keys de localStorage', entries: buildEntries(storage, 'storage') },
  { name: 'map', description: 'Coordenadas y colores del mapa', entries: buildEntries(map, 'map') },
  { name: 'business', description: 'Price levels, categorías, labels', entries: buildEntries(business, 'business') },
  { name: 'tags', description: 'Tags predefinidos e IDs válidos', entries: buildEntries(tags, 'tags') },
  { name: 'rankings', description: 'Scoring, medallas, labels', entries: buildEntries(rankings, 'rankings') },
  { name: 'feedback', description: 'Categorías válidas de feedback', entries: buildEntries(feedback, 'feedback') },
  { name: 'ui', description: 'Colores de charts, URLs', entries: buildEntries(ui, 'ui') },
  { name: 'admin', description: 'Admin config y labels', entries: buildEntries(admin, 'admin') },
  { name: 'timing', description: 'Intervalos y duraciones', entries: buildEntries(timing, 'timing') },
];
