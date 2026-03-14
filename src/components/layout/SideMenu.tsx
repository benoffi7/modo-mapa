import { useState, useEffect, lazy, Suspense } from 'react';
import {
  Drawer,
  Box,
  Avatar,
  Typography,
  IconButton,
  List,
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
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import BarChartIcon from '@mui/icons-material/BarChart';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../../context/AuthContext';
import { useColorMode } from '../../hooks/useColorMode';
import HistoryIcon from '@mui/icons-material/History';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { trackEvent } from '../../utils/analytics';
import { ADD_BUSINESS_URL } from '../../constants/ui';
import { MAX_DISPLAY_NAME_LENGTH } from '../../constants/validation';

// Lazy-loaded section components (P1.3 — keeps them out of the main chunk)
const FavoritesList = lazy(() => import('../menu/FavoritesList'));
const RecentVisits = lazy(() => import('../menu/RecentVisits'));
const CommentsList = lazy(() => import('../menu/CommentsList'));
const RatingsList = lazy(() => import('../menu/RatingsList'));
const FeedbackForm = lazy(() => import('../menu/FeedbackForm'));
const StatsView = lazy(() => import('../menu/StatsView'));
const RankingsView = lazy(() => import('../menu/RankingsView'));
const SettingsPanel = lazy(() => import('../menu/SettingsPanel'));
const PrivacyPolicy = lazy(() => import('../menu/PrivacyPolicy'));
const SuggestionsView = lazy(() => import('../menu/SuggestionsView'));
const HelpSection = lazy(() => import('../menu/HelpSection'));
const EmailPasswordDialog = lazy(() => import('../auth/EmailPasswordDialog'));

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
}

type Section = 'nav' | 'favorites' | 'recent' | 'suggestions' | 'comments' | 'ratings' | 'feedback' | 'stats' | 'rankings' | 'settings' | 'help' | 'privacy';

const SECTION_TITLES: Record<Exclude<Section, 'nav'>, string> = {
  favorites: 'Favoritos',
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

export default function SideMenu({ open, onClose }: Props) {
  const { displayName, setDisplayName, authMethod, emailVerified, user } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  useEffect(() => {
    if (open) trackEvent('side_menu_open');
  }, [open]);

  const [activeSection, setActiveSectionRaw] = useState<Section>('nav');

  const setActiveSection = (section: Section) => {
    setActiveSectionRaw(section);
    if (section !== 'nav') {
      trackEvent('side_menu_section', { section });
    }
  };
  const [feedbackKey, setFeedbackKey] = useState(0);

  // Edit name dialog
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Email auth dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogTab, setEmailDialogTab] = useState<'register' | 'login'>('register');

  const handleClose = () => {
    onClose();
    // Reset to nav after drawer closes
    setTimeout(() => setActiveSection('nav'), 300);
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

  const handleBackToNav = () => setActiveSection('nav');

  const userName = displayName || 'Anónimo';

  return (
    <>
      <Drawer
        anchor="left"
        open={open}
        onClose={handleClose}
      >
        <Box sx={{ width: 'min(300px, 80vw)', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {activeSection === 'nav' ? (
            <>
              {/* User header */}
              <Box sx={{ p: 2, pb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: '#1a73e8', width: 40, height: 40 }}>
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
                      onClick={() => { setEmailDialogTab('register'); setEmailDialogOpen(true); }}
                    >
                      Crear cuenta
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      fullWidth
                      onClick={() => { setEmailDialogTab('login'); setEmailDialogOpen(true); }}
                    >
                      Ya tengo cuenta
                    </Button>
                  </Box>
                )}
              </Box>
              <Divider />

              {/* Navigation */}
              <List>
                <ListItemButton onClick={() => setActiveSection('favorites')}>
                  <ListItemIcon>
                    <FavoriteIcon sx={{ color: '#ea4335' }} />
                  </ListItemIcon>
                  <ListItemText primary="Favoritos" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('recent')}>
                  <ListItemIcon>
                    <HistoryIcon sx={{ color: '#ff9800' }} />
                  </ListItemIcon>
                  <ListItemText primary="Recientes" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('suggestions')}>
                  <ListItemIcon>
                    <LightbulbOutlinedIcon sx={{ color: '#fbc02d' }} />
                  </ListItemIcon>
                  <ListItemText primary="Sugeridos" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('comments')}>
                  <ListItemIcon>
                    <ChatBubbleOutlineIcon sx={{ color: '#1a73e8' }} />
                  </ListItemIcon>
                  <ListItemText primary="Comentarios" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('ratings')}>
                  <ListItemIcon>
                    <StarOutlineIcon sx={{ color: '#fbbc04' }} />
                  </ListItemIcon>
                  <ListItemText primary="Calificaciones" />
                </ListItemButton>

                <ListItemButton onClick={() => { setFeedbackKey((k) => k + 1); setActiveSection('feedback'); }}>
                  <ListItemIcon>
                    <FeedbackOutlinedIcon sx={{ color: '#34a853' }} />
                  </ListItemIcon>
                  <ListItemText primary="Feedback" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('rankings')}>
                  <ListItemIcon>
                    <LeaderboardIcon sx={{ color: '#e65100' }} />
                  </ListItemIcon>
                  <ListItemText primary="Rankings" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('stats')}>
                  <ListItemIcon>
                    <BarChartIcon sx={{ color: '#7b1fa2' }} />
                  </ListItemIcon>
                  <ListItemText primary="Estadísticas" />
                </ListItemButton>
              </List>

              <Divider />

              <List>
                <ListItemButton onClick={() => window.open(ADD_BUSINESS_URL, '_blank')}>
                  <ListItemIcon>
                    <AddBusinessIcon sx={{ color: '#5f6368' }} />
                  </ListItemIcon>
                  <ListItemText primary="Agregar comercio" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('settings')}>
                  <ListItemIcon>
                    <SettingsOutlinedIcon sx={{ color: '#5f6368' }} />
                  </ListItemIcon>
                  <ListItemText primary="Configuración" />
                </ListItemButton>

                <ListItemButton onClick={() => setActiveSection('help')}>
                  <ListItemIcon>
                    <HelpOutlineIcon sx={{ color: '#5f6368' }} />
                  </ListItemIcon>
                  <ListItemText primary="Ayuda" />
                </ListItemButton>
              </List>

              {/* Version footer + dark mode toggle */}
              <Box sx={{ mt: 'auto' }}>
                <Divider />
                <ListItemButton onClick={() => { trackEvent('dark_mode_toggle', { enabled: mode !== 'dark' }); toggleColorMode(); }} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {mode === 'dark' ? <DarkModeIcon sx={{ color: '#ffb74d' }} /> : <LightModeIcon sx={{ color: '#fb8c00' }} />}
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
                  {activeSection === 'recent' && <RecentVisits onNavigate={handleClose} />}
                  {activeSection === 'suggestions' && <SuggestionsView onNavigate={handleClose} />}
                  {activeSection === 'comments' && <CommentsList onNavigate={handleClose} />}
                  {activeSection === 'ratings' && <RatingsList onNavigate={handleClose} />}
                  {activeSection === 'feedback' && <FeedbackForm key={feedbackKey} />}
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
      </Drawer>

      {/* Email auth dialog */}
      <Suspense fallback={null}>
        {emailDialogOpen && (
          <EmailPasswordDialog
            open={emailDialogOpen}
            onClose={() => setEmailDialogOpen(false)}
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
    </>
  );
}
