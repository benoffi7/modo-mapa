export interface ListIconOption {
  id: string;
  label: string;
  emoji: string;
}

export const LIST_ICON_OPTIONS: ListIconOption[] = [
  { id: 'food', label: 'Comida', emoji: '🍽️' },
  { id: 'coffee', label: 'Cafe', emoji: '☕' },
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'burger', label: 'Hamburguesa', emoji: '🍔' },
  { id: 'sushi', label: 'Sushi', emoji: '🍣' },
  { id: 'ice_cream', label: 'Helado', emoji: '🍦' },
  { id: 'beer', label: 'Cerveza', emoji: '🍺' },
  { id: 'wine', label: 'Vino', emoji: '🍷' },
  { id: 'cocktail', label: 'Cocktail', emoji: '🍹' },
  { id: 'cake', label: 'Torta', emoji: '🎂' },
  { id: 'star', label: 'Estrella', emoji: '⭐' },
  { id: 'heart', label: 'Corazon', emoji: '❤️' },
  { id: 'fire', label: 'Fuego', emoji: '🔥' },
  { id: 'trophy', label: 'Trofeo', emoji: '🏆' },
  { id: 'crown', label: 'Corona', emoji: '👑' },
  { id: 'map', label: 'Mapa', emoji: '🗺️' },
  { id: 'pin', label: 'Pin', emoji: '📍' },
  { id: 'bookmark', label: 'Marcador', emoji: '🔖' },
  { id: 'sparkle', label: 'Brillo', emoji: '✨' },
  { id: 'gem', label: 'Gema', emoji: '💎' },
  { id: 'leaf', label: 'Hoja', emoji: '🌿' },
  { id: 'sun', label: 'Sol', emoji: '☀️' },
  { id: 'moon', label: 'Luna', emoji: '🌙' },
  { id: 'rainbow', label: 'Arcoiris', emoji: '🌈' },
  { id: 'music', label: 'Musica', emoji: '🎵' },
  { id: 'camera', label: 'Camara', emoji: '📷' },
  { id: 'gift', label: 'Regalo', emoji: '🎁' },
  { id: 'rocket', label: 'Cohete', emoji: '🚀' },
  { id: 'house', label: 'Casa', emoji: '🏠' },
  { id: 'tree', label: 'Arbol', emoji: '🌳' },
];

export function getListIconById(id: string | undefined): ListIconOption | undefined {
  return LIST_ICON_OPTIONS.find((i) => i.id === id);
}
