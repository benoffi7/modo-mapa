import { TAB_BAR_HEIGHT } from '../components/layout/TabBar';

export interface NavLayout {
  /** Navigation position: bottom for mobile, left for desktop (future) */
  position: 'bottom' | 'left';
  /** Offset in px: height for bottom nav, width for left nav */
  offset: number;
}

/**
 * Returns the current navigation layout based on viewport.
 * Phase 1: always returns bottom (current mobile behavior).
 * Phase 2 (future): will use useMediaQuery to switch to left for desktop.
 */
export function useNavLayout(): NavLayout {
  return { position: 'bottom', offset: TAB_BAR_HEIGHT };
}
