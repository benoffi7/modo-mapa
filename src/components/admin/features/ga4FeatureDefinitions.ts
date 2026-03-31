import CasinoIcon from '@mui/icons-material/Casino';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import { createElement } from 'react';
import type { ReactElement } from 'react';

// ── Interfaces ───────────────────────────────────────────────────────

export interface GA4FeatureDef {
  key: string;
  name: string;
  icon: ReactElement;
  eventNames: string[];
  color: string;
}

export interface GA4FeatureCategory {
  id: string;
  label: string;
  features: GA4FeatureDef[];
}

// ── Helper to shorten icon creation ──────────────────────────────────

const icon = (component: React.ComponentType) => createElement(component);

// ── Feature categories ───────────────────────────────────────────────

export const GA4_FEATURE_CATEGORIES: GA4FeatureCategory[] = [
  {
    id: 'onboarding',
    label: 'Onboarding',
    features: [
      { key: 'onboarding_banner', name: 'Banner onboarding', icon: icon(SchoolOutlinedIcon), eventNames: ['onboarding_banner_shown', 'onboarding_banner_clicked', 'onboarding_banner_dismissed'], color: '#4CAF50' },
      { key: 'benefits_screen', name: 'Pantalla beneficios', icon: icon(SchoolOutlinedIcon), eventNames: ['benefits_screen_shown', 'benefits_screen_continue'], color: '#66BB6A' },
      { key: 'activity_reminder', name: 'Recordatorio actividad', icon: icon(SchoolOutlinedIcon), eventNames: ['activity_reminder_shown', 'activity_reminder_clicked'], color: '#81C784' },
      { key: 'verification_nudge', name: 'Nudge verificacion', icon: icon(SchoolOutlinedIcon), eventNames: ['verification_nudge_shown', 'verification_nudge_resend', 'verification_nudge_dismissed'], color: '#A5D6A7' },
    ],
  },
  {
    id: 'trending',
    label: 'Trending',
    features: [
      { key: 'trending_viewed', name: 'Trending visto', icon: icon(TrendingUpIcon), eventNames: ['trending_viewed'], color: '#FF5722' },
      { key: 'trending_business', name: 'Trending negocio', icon: icon(TrendingUpIcon), eventNames: ['trending_business_clicked'], color: '#FF7043' },
      { key: 'trending_near', name: 'Trending cerca', icon: icon(TrendingUpIcon), eventNames: ['trending_near_viewed', 'trending_near_tapped', 'trending_near_configure_tapped'], color: '#FF8A65' },
      { key: 'rankings_zone', name: 'Rankings zona', icon: icon(TrendingUpIcon), eventNames: ['rankings_zone_filter'], color: '#FFAB91' },
    ],
  },
  {
    id: 'home',
    label: 'Home Engagement',
    features: [
      { key: 'special_tapped', name: 'Especiales', icon: icon(HomeOutlinedIcon), eventNames: ['special_tapped'], color: '#2196F3' },
      { key: 'for_you', name: 'Para vos', icon: icon(HomeOutlinedIcon), eventNames: ['for_you_tapped'], color: '#42A5F5' },
      { key: 'quick_action', name: 'Acciones rapidas', icon: icon(HomeOutlinedIcon), eventNames: ['quick_action_tapped'], color: '#64B5F6' },
      { key: 'recent_search', name: 'Busqueda reciente', icon: icon(HomeOutlinedIcon), eventNames: ['recent_search_tapped'], color: '#90CAF9' },
    ],
  },
  {
    id: 'interests',
    label: 'Interests',
    features: [
      { key: 'tag_follow', name: 'Seguir tag', icon: icon(LocalOfferOutlinedIcon), eventNames: ['tag_followed', 'tag_unfollowed'], color: '#9C27B0' },
      { key: 'interests_section', name: 'Seccion intereses', icon: icon(LocalOfferOutlinedIcon), eventNames: ['interests_section_viewed'], color: '#AB47BC' },
      { key: 'interests_business', name: 'Negocio intereses', icon: icon(LocalOfferOutlinedIcon), eventNames: ['interests_business_tapped'], color: '#BA68C8' },
      { key: 'interests_cta', name: 'CTA intereses', icon: icon(LocalOfferOutlinedIcon), eventNames: ['interests_cta_tapped', 'interests_suggested_tapped'], color: '#CE93D8' },
    ],
  },
  {
    id: 'digest',
    label: 'Digest',
    features: [
      { key: 'digest_section', name: 'Seccion digest', icon: icon(EmailOutlinedIcon), eventNames: ['digest_section_viewed'], color: '#009688' },
      { key: 'digest_item', name: 'Item digest', icon: icon(EmailOutlinedIcon), eventNames: ['digest_item_tapped'], color: '#26A69A' },
      { key: 'digest_cta', name: 'CTA digest', icon: icon(EmailOutlinedIcon), eventNames: ['digest_cta_tapped'], color: '#4DB6AC' },
      { key: 'digest_frequency', name: 'Frecuencia digest', icon: icon(EmailOutlinedIcon), eventNames: ['digest_frequency_changed'], color: '#80CBC4' },
    ],
  },
  {
    id: 'offline',
    label: 'Offline',
    features: [
      { key: 'offline_queue', name: 'Cola offline', icon: icon(CloudOffOutlinedIcon), eventNames: ['offline_action_queued'], color: '#795548' },
      { key: 'offline_sync', name: 'Sync offline', icon: icon(CloudOffOutlinedIcon), eventNames: ['offline_sync_completed', 'offline_sync_failed'], color: '#8D6E63' },
      { key: 'offline_discard', name: 'Descarte offline', icon: icon(CloudOffOutlinedIcon), eventNames: ['offline_action_discarded'], color: '#A1887F' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    features: [
      { key: 'business_view', name: 'Vista negocio', icon: icon(StorefrontOutlinedIcon), eventNames: ['business_view'], color: '#FF9800' },
      { key: 'business_directions', name: 'Direcciones', icon: icon(StorefrontOutlinedIcon), eventNames: ['business_directions'], color: '#FFA726' },
      { key: 'rating_prompt', name: 'Prompt calificacion', icon: icon(StorefrontOutlinedIcon), eventNames: ['rating_prompt_shown', 'rating_prompt_clicked', 'rating_prompt_dismissed', 'rating_prompt_converted'], color: '#FFB74D' },
      { key: 'business_sheet', name: 'Sheet negocio', icon: icon(StorefrontOutlinedIcon), eventNames: ['business_sheet_phase1_ms', 'business_sheet_phase2_ms', 'business_sheet_cache_hit'], color: '#FFCC80' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    features: [
      { key: 'follow_unfollow', name: 'Follow/Unfollow', icon: icon(PeopleOutlinedIcon), eventNames: ['follow', 'unfollow'], color: '#3F51B5' },
      { key: 'feed', name: 'Feed', icon: icon(PeopleOutlinedIcon), eventNames: ['feed_viewed', 'feed_item_clicked'], color: '#5C6BC0' },
      { key: 'recommendation', name: 'Recomendaciones', icon: icon(PeopleOutlinedIcon), eventNames: ['recommendation_sent', 'recommendation_opened', 'recommendation_list_viewed'], color: '#7986CB' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    features: [
      { key: 'force_update', name: 'Force update', icon: icon(SettingsOutlinedIcon), eventNames: ['force_update_triggered', 'force_update_limit_reached'], color: '#607D8B' },
      { key: 'account_deleted', name: 'Cuenta eliminada', icon: icon(SettingsOutlinedIcon), eventNames: ['account_deleted'], color: '#78909C' },
    ],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    features: [
      { key: 'tab_switch', name: 'Cambio tab', icon: icon(ExploreOutlinedIcon), eventNames: ['tab_switched', 'sub_tab_switched'], color: '#00BCD4' },
      { key: 'business_sheet_tab', name: 'Tab sheet negocio', icon: icon(ExploreOutlinedIcon), eventNames: ['business_sheet_tab_changed'], color: '#26C6DA' },
    ],
  },
  {
    id: 'other',
    label: 'Otras features',
    features: [
      { key: 'surprise', name: 'Sorprendeme!', icon: icon(CasinoIcon), eventNames: ['surprise_me'], color: '#FF5722' },
      { key: 'lists', name: 'Listas', icon: icon(BookmarkBorderIcon), eventNames: ['list_created', 'list_item_added', 'list_icon_changed'], color: '#795548' },
      { key: 'search', name: 'Busqueda', icon: icon(SearchIcon), eventNames: ['business_search'], color: '#607D8B' },
      { key: 'share', name: 'Compartir', icon: icon(ShareIcon), eventNames: ['business_share'], color: '#00BCD4' },
      { key: 'photos', name: 'Fotos', icon: icon(CameraAltOutlinedIcon), eventNames: ['menu_photo_upload'], color: '#8BC34A' },
      { key: 'darkMode', name: 'Dark Mode', icon: icon(DarkModeOutlinedIcon), eventNames: ['dark_mode_toggle'], color: '#424242' },
      { key: 'questions', name: 'Preguntas', icon: icon(HelpOutlineIcon), eventNames: ['question_created', 'question_answered'], color: '#00BCD4' },
    ],
  },
];
