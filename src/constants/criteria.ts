import type { RatingCriterionId } from '../types';

export interface CriterionConfig {
  id: RatingCriterionId;
  label: string;
}

export const RATING_CRITERIA: readonly CriterionConfig[] = [
  { id: 'food', label: 'Comida' },
  { id: 'service', label: 'Atención' },
  { id: 'price', label: 'Precio' },
  { id: 'ambiance', label: 'Ambiente' },
  { id: 'speed', label: 'Rapidez' },
] as const;
