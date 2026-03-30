import { lazy, type ComponentType } from 'react';

export interface HomeSection {
  id: string;
  component: ComponentType;
  hasDividerAfter?: boolean;
}

const GreetingHeader = lazy(() => import('./GreetingHeader'));
const QuickActions = lazy(() => import('./QuickActions'));
const SpecialsSection = lazy(() => import('./SpecialsSection'));
const TrendingNearYouSection = lazy(() => import('./TrendingNearYouSection'));
const YourInterestsSection = lazy(() => import('./YourInterestsSection'));
const RecentSearches = lazy(() => import('./RecentSearches'));
const ForYouSection = lazy(() => import('./ForYouSection'));
const ActivityDigestSection = lazy(() => import('./ActivityDigestSection'));

export const HOME_SECTIONS: HomeSection[] = [
  { id: 'greeting', component: GreetingHeader },
  { id: 'quick-actions', component: QuickActions, hasDividerAfter: true },
  { id: 'specials', component: SpecialsSection, hasDividerAfter: true },
  { id: 'trending-near', component: TrendingNearYouSection, hasDividerAfter: true },
  { id: 'interests', component: YourInterestsSection, hasDividerAfter: true },
  { id: 'recent-searches', component: RecentSearches },
  { id: 'for-you', component: ForYouSection, hasDividerAfter: true },
  { id: 'digest', component: ActivityDigestSection },
];
