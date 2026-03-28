import { useState, lazy, Suspense } from 'react';
import { Box, Typography, Avatar, Divider, IconButton, CircularProgress, Toolbar } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../../context/AuthContext';
import { useProfileStats } from '../../hooks/useProfileStats';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { getAvatarById } from '../../constants/avatars';
import StatsCards from './StatsCards';
import SettingsMenu from './SettingsMenu';
import type { SettingsSection } from './SettingsMenu';

const AvatarPicker = lazy(() => import('./AvatarPicker'));
const EditDisplayNameDialog = lazy(() => import('../menu/EditDisplayNameDialog'));

const OnboardingChecklist = lazy(() => import('../menu/OnboardingChecklist'));
const NotificationsSection = lazy(() => import('./NotificationsSection'));
const PendingActionsSection = lazy(() => import('../menu/PendingActionsSection'));
const SettingsPanel = lazy(() => import('../menu/SettingsPanel'));
const HelpSection = lazy(() => import('../menu/HelpSection'));
const FeedbackForm = lazy(() => import('../menu/FeedbackForm'));
const PrivacyPolicy = lazy(() => import('../menu/PrivacyPolicy'));
const CommentsList = lazy(() => import('../menu/CommentsList'));
const RatingsList = lazy(() => import('../menu/RatingsList'));
const StatsView = lazy(() => import('../menu/StatsView'));
const AchievementsSection = lazy(() => import('./AchievementsSection'));
const AchievementsGrid = lazy(() => import('./AchievementsGrid'));

const SECTION_TITLES: Record<string, string> = {
  notifications: 'Notificaciones',
  pendientes: 'Pendientes',
  privacy: 'Privacidad',
  config: 'Configuración',
  help: 'Ayuda y soporte',
  reviews: 'Resenas',
  stats: 'Estadisticas',
  achievements: 'Logros',
};

function SectionLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

export default function ProfileScreen() {
  const { displayName, user, avatarId, setAvatarId } = useAuth();
  const profileStats = useProfileStats();
  const { isOffline } = useConnectivity();
  const { navigateToListsSubTab } = useTabNavigation();
  const { navigateToBusiness } = useNavigateToBusiness();
  const [activeSection, setActiveSection] = useState<SettingsSection | 'reviews' | 'stats' | 'achievements' | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);

  const avatar = getAvatarById(avatarId ?? undefined);

  const userName = displayName || 'Anonimo';
  const hasPendingActions = isOffline;

  if (activeSection) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => setActiveSection(null)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={600}>
            {SECTION_TITLES[activeSection] ?? activeSection}
          </Typography>
        </Toolbar>
        <Divider />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Suspense fallback={<SectionLoader />}>
            {activeSection === 'notifications' && <NotificationsSection />}
            {activeSection === 'pendientes' && <PendingActionsSection />}
            {activeSection === 'privacy' && <PrivacyPolicy />}
            {activeSection === 'config' && <SettingsPanel />}
            {activeSection === 'help' && (
              <>
                <HelpSection />
                <Divider sx={{ my: 1 }} />
                <FeedbackForm />
              </>
            )}
            {activeSection === 'reviews' && (
              <>
                <RatingsList onSelectBusiness={(biz) => navigateToBusiness(biz)} />
                <Divider sx={{ my: 1 }} />
                <CommentsList onSelectBusiness={(biz) => navigateToBusiness(biz)} />
              </>
            )}
            {activeSection === 'stats' && <StatsView />}
            {activeSection === 'achievements' && <AchievementsGrid />}
          </Suspense>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 3, pb: 1 }}>
        <Avatar
          onClick={() => setAvatarPickerOpen(true)}
          sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: avatar ? 32 : 28, mb: 1, cursor: 'pointer' }}
        >
          {avatar ? avatar.emoji : userName.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h6" fontWeight={700}>{userName}</Typography>
          <IconButton size="small" onClick={() => setNameDialogOpen(true)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      <Suspense fallback={null}>
        {avatarPickerOpen && (
          <AvatarPicker
            open
            onClose={() => setAvatarPickerOpen(false)}
            onSelect={(a) => setAvatarId(a.id)}
            selectedId={avatarId ?? undefined}
          />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {nameDialogOpen && (
          <EditDisplayNameDialog open onClose={() => setNameDialogOpen(false)} />
        )}
      </Suspense>

      {/* Onboarding */}
      {user && !user.isAnonymous && (
        <Suspense fallback={null}>
          <OnboardingChecklist menuOpen />
        </Suspense>
      )}

      {/* Stats */}
      <StatsCards
        places={profileStats.places}
        reviews={profileStats.reviews}
        followers={profileStats.followers}
        favorites={profileStats.favorites}
        onPlacesTap={() => setActiveSection('stats')}
        onReviewsTap={() => setActiveSection('reviews')}
        onFavoritesTap={() => navigateToListsSubTab('favoritos')}
      />

      <Divider sx={{ my: 1 }} />

      {/* Achievements */}
      <Suspense fallback={null}>
        <AchievementsSection onViewAll={() => setActiveSection('achievements')} />
      </Suspense>

      <Divider />

      {/* Settings */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary">Ajustes</Typography>
      </Box>
      <SettingsMenu onNavigate={setActiveSection} hasPendingActions={hasPendingActions} />
    </Box>
  );
}
