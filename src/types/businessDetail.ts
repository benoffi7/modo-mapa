import type { UserTag, CustomTag, MenuPhoto, PriceLevel } from './business';

export type BusinessDetailTab = 'criterios' | 'precio' | 'tags' | 'foto' | 'opiniones';
export const BUSINESS_DETAIL_TABS: readonly BusinessDetailTab[] = ['criterios', 'precio', 'tags', 'foto', 'opiniones'] as const;

export interface PriceLevelData {
  levels: PriceLevel[];
  onChange: () => void;
}

export interface TagsData {
  seed: string[];
  user: UserTag[];
  custom: CustomTag[];
  onChange: () => void;
}

export interface PhotoData {
  photo: MenuPhoto | null;
  onChange: () => void;
}
