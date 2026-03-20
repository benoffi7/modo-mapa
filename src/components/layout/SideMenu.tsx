import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import {
  SwipeableDrawer,
  Box,
  Avatar,
  Typography,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAuth } from '../../context/AuthContext';
import { useColorMode } from '../../hooks/useColorMode';
import { useNotifications } from '../../hooks/useNotifications';
import SideMenuNav from './SideMenuNav';
import { trackEvent } from '../../utils/analytics';
import { useToast } from '../../context/ToastContext';
import { useSelection, useFilters } from '../../context/MapContext';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { allBusinesses } from '../../hooks/useBusinesses';
import { distanceKm } from '../../utils/distance';
import { MAX_DISPLAY_NAME_LENGTH } from '../../constants/validation';
import DiscardDialog from '../common/DiscardDialog';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

// Lazy-loaded section components (P1.3 — keeps them out of the main chunk)
const FavoritesList = lazy(() => import('../menu/FavoritesList'));
const RecentVisits = lazy(() => import('../menu/RecentVisits'));
const CommentsList = lazy(() => import('../menu/CommentsList'));
const RatingsList = lazy(() => import('../menu/RatingsList'));
const SharedListsView = lazy(() => import('../menu/SharedListsView'));
const FeedbackForm = lazy(() => import('../menu/FeedbackForm'));
const StatsView = lazy(() => import('../menu/StatsView'));
const RankingsView = lazy(() => import('../menu/RankingsView'));
const SettingsPanel = lazy(() => import('../menu/SettingsPanel'));
const PrivacyPolicy = lazy(() => import('../menu/PrivacyPolicy'));
const SuggestionsView = lazy(() => import('../menu/SuggestionsView'));
const HelpSection = lazy(() => import('../menu/HelpSection'));
const OnboardingChecklist = lazy(() => import('../menu/OnboardingChecklist'));
const EmailPasswordDialog = lazy(() => import('../auth/EmailPasswordDialog'));
import VerificationNudge from '../onboarding/VerificationNudge';

function SectionLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

declare const __APP_VERSION__: string;

interface Props {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  onClearSharedList?: () => void;
  initialSection?: string | undefined;
  sharedListId?: string | undefined;
  onCreateAccount: (source: 'banner' | 'menu' | 'settings') => void;
  onLogin: () => void;
  emailDialogOpen: boolean;
  emailDialogTab: 'register' | 'login';
  onEmailDialogClose: () => void;
}

export type Section = 'nav' | 'favorites' | 'lists' | 'recent' | 'suggestions' | 'comments' | 'ratings' | 'feedback' | 'stats' | 'rankings' | 'settings' | 'help' | 'privacy';

const SECTION_TITLES: Record<Exclude<Section, 'nav'>, string> = {
  favorites: 'Favoritos',
  lists: 'Mis Listas',
  recent: 'Recientes',
  suggestions: 'Sugeridos para vos',
  comments: 'Comentarios',
  ratings: 'Calificaciones',
  feedback: 'Feedback',
  stats: 'Estadísticas',
  rankings: 'Rankings',
  settings: 'Configuración',
  help: 'Ayuda',
  privacy: 'Política de privacidad',
};

export default function SideMenu({ open, onClose, onOpen, onClearSharedList, initialSection, sharedListId, onCreateAccount, onLogin, emailDialogOpen, emailDialogTab, onEmailDialogClose }: Props) {
  const { displayName, setDisplayName, authMethod, emailVerified, user } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const { notifications } = useNotifications();
  const toast = useToast();
  const { setSelectedBusiness } = useSelection();
  const { userLocation } = useFilters();
  const { visits } = useVisitHistory();
  const unreadReplyCount = useMemo(
    () => notifications.filter((n) => n.type === 'comment_reply' && !n.read).length,
    [notifications],
  );
  useEffect(() => {
    if (open) trackEvent('side_menu_open');
  }, [open]);

  const [activeSection, setActiveSectionRaw] = useState<Section>('nav');

  useEffect(() => {
    if (initialSection && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- set initial section from deep link
      setActiveSectionRaw(initialSection as Section);
    }
  }, [initialSection, open]);

  const setActiveSection = (section: Section) => {
    // When navigating to lists from nav, clear any stale shared list state
    if (section === 'lists') {
      onClearSharedList?.();
      listsBackHandler.current?.();
    }
    setActiveSectionRaw(section);
    if (section !== 'nav') {
      trackEvent('side_menu_section', { section });
    }
  };
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [feedbackDirty, setFeedbackDirty] = useState(false);
  const { confirmClose, dialogProps } = useUnsavedChanges(
    activeSection === 'feedback' && feedbackDirty ? 'x' : '',
  );

  const handleSurprise = () => {
    const visitedIds = new Set(visits.map((v) => v.businessId));
    let candidates = allBusinesses.filter((b) => !visitedIds.has(b.id));

    // If GPS available, prefer nearby (within 5km)
    if (userLocation && candidates.length > 0) {
      const nearby = candidates.filter(
        (b) => distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng) <= 5,
      );
      if (nearby.length > 0) candidates = nearby;
    }

    const pool = candidates.length > 0 ? candidates : allBusinesses;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setSelectedBusiness(pick);
    onClose();
    if (candidates.length === 0) {
      toast.info('¡Ya visitaste todos! Te sorprendemos con uno al azar.');
    } else {
      toast.success(`¡Sorpresa! Descubrí ${pick.name}`);
    }
    trackEvent('surprise_me', { business_id: pick.id });
  };

  // Edit name dialog
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    confirmClose(() => {
      onClose();
      // Reset to nav after drawer closes
      setTimeout(() => setActiveSection('nav'), 300);
    });
  };

  const handleOpenNameDialog = () => {
    setNameValue(displayName || '');
    setNameDialogOpen(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    setIsSaving(true);
    await setDisplayName(trimmed);
    setIsSaving(false);
    setNameDialogOpen(false);
  };

  // Back handler for lists section: first clears shared list view, then goes to nav
  const listsBackHandler = useRef<(() => boolean) | null>(null);
  const registerListsBackHandler = useMemo(() => (h: (() => boolean) | null) => { listsBackHandler.current = h; }, []);

  const handleBackToNav = () => {
    if (activeSection === 'lists' && listsBackHandler.current?.()) {
      return; // SharedListsView handled it (cleared shared list → showing user's lists)
    }
    setActiveSection('nav');
  };

  const userName = displayName || 'Anónimo';

  return (
    <>
      <SwipeableDrawer
        anchor="left"
        open={open}
        onClose={handleClose}
        onOpen={onOpen}
        swipeAreaWidth={20}
        disableSwipeToOpen={false}
        disableBackdropTransition
        disableDiscovery
      >
        <Box sx={{ width: 'min(300px, 80vw)', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {activeSection === 'nav' ? (
            <>
              {/* User header */}
              <Box sx={{ p: 2, pb: 1.5, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                    {userName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                      {userName}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: authMethod === 'anonymous' ? 'warning.main' : 'success.main',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      {authMethod === 'anonymous' ? (
                        'Cuenta temporal'
                      ) : (
                        <>
                          {user?.email}
                          {emailVerified
                            ? <VerifiedIcon sx={{ fontSize: 14 }} />
                            : <ErrorOutlineIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                        </>
                      )}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={handleOpenNameDialog}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
                {authMethod === 'anonymous' && (
                  <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      onClick={() => onCreateAccount('menu')}
                    >
                      Crear cuenta
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      fullWidth
                      onClick={onLogin}
                    >
                      Ya tengo cuenta
                    </Button>
                  </Box>
                )}
              </Box>
              {user && !user.isAnonymous && (
                <Box sx={{ flexShrink: 0 }}>
                  <VerificationNudge />
                  <Suspense fallback={null}>
                    <OnboardingChecklist menuOpen={open} />
                  </Suspense>
                  <Divider />
                </Box>
              )}

              {/* Navigation — scrollable when onboarding cards take space */}
              <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <SideMenuNav
                  unreadReplyCount={unreadReplyCount}
                  onNavigate={setActiveSection}
                  onSurprise={handleSurprise}
                  onFeedback={() => { setFeedbackKey((k) => k + 1); setActiveSection('feedback'); }}
                />
              </Box>

              {/* Version footer + dark mode toggle */}
              <Box sx={{ mt: 'auto' }}>
                <Divider />
                <ListItemButton onClick={() => { trackEvent('dark_mode_toggle', { enabled: mode !== 'dark' }); toggleColorMode(); }} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {mode === 'dark' ? <DarkModeIcon sx={{ color: 'warning.light' }} /> : <LightModeIcon sx={{ color: 'warning.main' }} />}
                  </ListItemIcon>
                  <ListItemText primary="Modo oscuro" />
                  <Switch
                    edge="end"
                    size="small"
                    checked={mode === 'dark'}
                    onChange={toggleColorMode}
                    onClick={(e) => e.stopPropagation()}
                  />
                </ListItemButton>
                <Divider />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  onClick={() => setActiveSection('privacy')}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 1, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                >
                  <PrivacyTipOutlinedIcon sx={{ fontSize: 14 }} />
                  Política de privacidad
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', pb: 1.5 }}>
                  Versión {__APP_VERSION__}
                  {import.meta.env.DEV && (
                    <>
                      {' · '}
                      <Typography
                        component="a"
                        href="/dev/theme"
                        variant="caption"
                        sx={{ color: 'text.disabled', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        Theme
                      </Typography>
                      {' · '}
                      <Typography
                        component="a"
                        href="/dev/constants"
                        variant="caption"
                        sx={{ color: 'text.disabled', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        Constants
                      </Typography>
                    </>
                  )}
                </Typography>
              </Box>
            </>
          ) : (
            <>
              {/* Section header with back button */}
              <Toolbar variant="dense" sx={{ gap: 1 }}>
                <IconButton edge="start" onClick={handleBackToNav}>
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {SECTION_TITLES[activeSection]}
                </Typography>
              </Toolbar>
              <Divider />

              {/* Section content — lazy-loaded */}
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <Suspense fallback={<SectionLoader />}>
                  {activeSection === 'favorites' && <FavoritesList onNavigate={handleClose} />}
                  {activeSection === 'lists' && <SharedListsView onNavigate={handleClose} sharedListId={sharedListId} onRegisterBackHandler={registerListsBackHandler} />}
                  {activeSection === 'recent' && <RecentVisits onNavigate={handleClose} />}
                  {activeSection === 'suggestions' && <SuggestionsView onNavigate={handleClose} />}
                  {activeSection === 'comments' && <CommentsList onNavigate={handleClose} />}
                  {activeSection === 'ratings' && <RatingsList onNavigate={handleClose} />}
                  {activeSection === 'feedback' && <FeedbackForm key={feedbackKey} onDirtyChange={setFeedbackDirty} />}
                  {activeSection === 'rankings' && <RankingsView />}
                  {activeSection === 'stats' && <StatsView />}
                  {activeSection === 'settings' && <SettingsPanel />}
                  {activeSection === 'help' && <HelpSection />}
                  {activeSection === 'privacy' && <PrivacyPolicy />}
                </Suspense>
              </Box>
            </>
          )}
        </Box>
      </SwipeableDrawer>

      {/* Email auth dialog — fully controlled by AppShell */}
      <Suspense fallback={null}>
        {emailDialogOpen && (
          <EmailPasswordDialog
            open
            onClose={onEmailDialogClose}
            initialTab={emailDialogTab}
          />
        )}
      </Suspense>

      {/* Edit name dialog */}
      <Dialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar nombre</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveName();
              }
            }}
            inputProps={{ maxLength: MAX_DISPLAY_NAME_LENGTH }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNameDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSaveName}
            variant="contained"
            disabled={isSaving || !nameValue.trim()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <DiscardDialog {...dialogProps} />
    </>
  );
}
