/** Definición estática de un achievement (sin progreso del usuario) */
export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
  /** MUI icon component name — se instancia en el componente consumidor */
  icon: string;
  /** MUI icon color prop */
  iconColor: 'success' | 'info' | 'warning' | 'secondary' | 'primary' | 'action' | 'error';
  target: number;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: 'explorador', label: 'Explorador', description: 'Hacé check-in en 10 lugares diferentes', icon: 'ExploreOutlined', iconColor: 'success', target: 10 },
  { id: 'social', label: 'Social', description: 'Seguí a 5 usuarios', icon: 'PeopleOutlined', iconColor: 'info', target: 5 },
  { id: 'critico', label: 'Crítico', description: 'Dejá 10 calificaciones', icon: 'RateReviewOutlined', iconColor: 'warning', target: 10 },
  { id: 'viajero', label: 'Viajero', description: 'Visitá comercios en 3 localidades', icon: 'FlightOutlined', iconColor: 'secondary', target: 3 },
  { id: 'coleccionista', label: 'Coleccionista', description: 'Agregá 20 favoritos', icon: 'BookmarkBorder', iconColor: 'primary', target: 20 },
  { id: 'fotografo', label: 'Fotógrafo', description: 'Subí 5 fotos de menú', icon: 'CameraAltOutlined', iconColor: 'action', target: 5 },
  { id: 'embajador', label: 'Embajador', description: 'Enviá 10 recomendaciones', icon: 'EmojiEventsOutlined', iconColor: 'warning', target: 10 },
  { id: 'racha', label: 'En racha', description: 'Usá la app 7 días seguidos', icon: 'LocalFireDepartment', iconColor: 'error', target: 7 },
];
