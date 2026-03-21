/** Single source of truth for trending scoring weights (server-side). */
export const TRENDING_SCORING = { ratings: 2, comments: 3, userTags: 1, priceLevels: 2, listItems: 1 } as const;
export const TRENDING_MAX_BUSINESSES = 10;
export const TRENDING_WINDOW_DAYS = 7;
