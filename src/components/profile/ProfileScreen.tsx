import { useState, lazy, Suspense } from 'react';
import { Box, Typography, Avatar, Divider, IconButton, CircularProgress, Toolbar } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';
import { useMyCheckIns } from '../../hooks/useMyCheckIns';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { getAvatarById } from '../../constants/avatars';
import StatsCards from './StatsCards';
import SettingsMenu from './SettingsMenu';
import type { SettingsSection } from './SettingsMenu';

const AvatarPicker = lazy(() => import('./AvatarPicker'));

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

const SECTION_TITLES: Record<string, string> = {
  notifications: 'Notificaciones',
  pendientes: 'Pendientes',
  privacy: 'Privacidad y ajuste',
  config: 'Configuracion',
  help: 'Ayuda y soporte',
  reviews: 'Resenas',
  stats: 'Estadisticas',
};

function SectionLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

export default function ProfileScreen() {
  const { displayName, user } = useAuth();
  const { stats } = useMyCheckIns();
  const { isOffline } = useConnectivity();
  const { navigateToListsSubTab } = useTabNavigation();
  const [activeSection, setActiveSection] = useState<SettingsSection | 'reviews' | 'stats' | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | undefined>(undefined);
  const avatar = getAvatarById(selectedAvatarId);

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
            {activeSection === 'privacy' && (
              <>
                <SettingsPanel />
                <Divider sx={{ my: 1 }} />
                <PrivacyPolicy />
              </>
            )}
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
                <RatingsList onSelectBusiness={() => {}} />
                <Divider sx={{ my: 1 }} />
                <CommentsList onSelectBusiness={() => {}} />
              </>
            )}
            {activeSection === 'stats' && <StatsView />}
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
        <Typography variant="h6" fontWeight={700}>{userName}</Typography>
      </Box>
      <Suspense fallback={null}>
        {avatarPickerOpen && (
          <AvatarPicker
            open
            onClose={() => setAvatarPickerOpen(false)}
            onSelect={(a) => setSelectedAvatarId(a.id)}
            selectedId={selectedAvatarId}
          />
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
        places={stats.uniqueBusinesses}
        reviews={0}
        followers={0}
        favorites={0}
        onPlacesTap={() => setActiveSection('stats')}
        onReviewsTap={() => setActiveSection('reviews')}
        onFavoritesTap={() => navigateToListsSubTab('favoritos')}
      />

      <Divider sx={{ my: 1 }} />

      {/* Achievements placeholder */}
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">Logros</Typography>
        <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
          Proximamente
        </Typography>
      </Box>

      <Divider />

      {/* Settings */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2" color="text.secondary">Ajustes</Typography>
      </Box>
      <SettingsMenu onNavigate={setActiveSection} hasPendingActions={hasPendingActions} />
    </Box>
  );
}
