/** Weights for the personalized suggestion scoring algorithm. */
export const SUGGESTION_WEIGHTS = {
  categoryMatch: 3,
  tagMatch: 2,
  nearbyBonus: 1,
  alreadyFavorite: -5,
  alreadyRated: -3,
} as const;

/** Maximum number of suggestions to display. */
export const MAX_SUGGESTIONS = 10;

/** Radius in km to consider a business "nearby". */
export const NEARBY_RADIUS_KM = 1;
