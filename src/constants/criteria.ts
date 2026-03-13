import type { RatingCriterionId } from '../types';

export interface CriterionConfig {
  id: RatingCriterionId;
  label: string;
  /** MUI icon name to import from @mui/icons-material */
  icon: string;
}

export const RATING_CRITERIA: readonly CriterionConfig[] = [
  { id: 'food', label: 'Comida', icon: 'RestaurantOutlined' },
  { id: 'service', label: 'Atenci\u00f3n', icon: 'EmojiPeopleOutlined' },
  { id: 'price', label: 'Precio', icon: 'AttachMoneyOutlined' },
  { id: 'ambiance', label: 'Ambiente', icon: 'HomeOutlined' },
  { id: 'speed', label: 'Rapidez', icon: 'BoltOutlined' },
] as const;
