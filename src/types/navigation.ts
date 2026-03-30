// Tab navigation (#158)
export type TabId = 'inicio' | 'social' | 'buscar' | 'listas' | 'perfil';
export const ALL_TAB_IDS: TabId[] = ['inicio', 'social', 'buscar', 'listas', 'perfil'];
export type SocialSubTab = 'actividad' | 'seguidos' | 'recomendaciones' | 'rankings';
export type ListsSubTab = 'favoritos' | 'listas' | 'recientes' | 'colaborativas';
export type SearchViewMode = 'map' | 'list';

export type LocationSource = 'gps' | 'locality' | 'office';
