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
  { id: 'leaf', label: 'Vegano', emoji: '🌿' },
  { id: 'brunch', label: 'Brunch', emoji: '🥐' },
  { id: 'ramen', label: 'Ramen', emoji: '🍜' },
  { id: 'taco', label: 'Taco', emoji: '🌮' },
  { id: 'donut', label: 'Donut', emoji: '🍩' },
  { id: 'gift', label: 'Para regalar', emoji: '🎁' },
  { id: 'family', label: 'Familiar', emoji: '👨‍👩‍👧' },
  { id: 'couple', label: 'Pareja', emoji: '💑' },
  { id: 'house', label: 'Barrio', emoji: '🏠' },
  { id: 'cutlery', label: 'Cubiertos', emoji: '🍴' },
];

const VALID_ICON_IDS = new Set(LIST_ICON_OPTIONS.map((i) => i.id));

/** Returns icon option by ID. Returns undefined for invalid/unknown IDs. */
export function getListIconById(id: string | undefined): ListIconOption | undefined {
  if (!id || typeof id !== 'string' || !VALID_ICON_IDS.has(id)) return undefined;
  return LIST_ICON_OPTIONS.find((i) => i.id === id);
}
