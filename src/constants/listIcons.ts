export interface ListIconOption {
  id: string;
  label: string;
  emoji: string;
}

export const LIST_ICON_OPTIONS: ListIconOption[] = [
  { id: 'food', label: 'Comida', emoji: '🍽️' },
  { id: 'coffee', label: 'Café', emoji: '☕' },
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'burger', label: 'Hamburguesa', emoji: '🍔' },
  { id: 'sushi', label: 'Sushi', emoji: '🍣' },
  { id: 'ice_cream', label: 'Helado', emoji: '🍦' },
  { id: 'beer', label: 'Cerveza', emoji: '🍺' },
  { id: 'wine', label: 'Vino', emoji: '🍷' },
  { id: 'cocktail', label: 'Cocktail', emoji: '🍹' },
  { id: 'cake', label: 'Torta', emoji: '🎂' },
  { id: 'star', label: 'Estrella', emoji: '⭐' },
  { id: 'heart', label: 'Corazón', emoji: '❤️' },
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

/**
 * Fallback map for legacy icon IDs that may exist in Firestore documents
 * created before the current icon set was standardized.
 * Maps old ID -> current ID. Populate as legacy IDs are discovered in production data.
 *
 * Example: { 'restaurant': 'food', 'drink': 'cocktail' }
 */
const LEGACY_ICON_MAP: Record<string, string> = {};

/**
 * Returns icon option by ID. Checks the legacy fallback map for deprecated IDs.
 * Returns `undefined` for unknown/invalid IDs — callers should fall back to a default icon.
 */
export function getListIconById(id: string | undefined): ListIconOption | undefined {
  if (!id || typeof id !== 'string') return undefined;
  const resolvedId = LEGACY_ICON_MAP[id] ?? id;
  if (!VALID_ICON_IDS.has(resolvedId)) return undefined;
  return LIST_ICON_OPTIONS.find((i) => i.id === resolvedId);
}
