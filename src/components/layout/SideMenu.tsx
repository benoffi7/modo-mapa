import { useState } from 'react';
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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import BarChartIcon from '@mui/icons-material/BarChart';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../../context/AuthContext';
import { useColorMode } from '../../hooks/useColorMode';
import FavoritesList from '../menu/FavoritesList';
import CommentsList from '../menu/CommentsList';
import RatingsList from '../menu/RatingsList';
import FeedbackForm from '../menu/FeedbackForm';
import StatsView from '../menu/StatsView';

declare const __APP_VERSION__: string;

const ADD_BUSINESS_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdCclz8fH1OQj-McD_xEsXAwP6umIcNVsudS3ZiYBXqBqoaRg/viewform';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Section = 'nav' | 'favorites' | 'comments' | 'ratings' | 'feedback' | 'stats';

const SECTION_TITLES: Record<Exclude<Section, 'nav'>, string> = {
  favorites: 'Favoritos',
  comments: 'Comentarios',
  ratings: 'Calificaciones',
  feedback: 'Feedback',
  stats: 'Estadísticas',
};

export default function SideMenu({ open, onClose }: Props) {
  const { displayName, setDisplayName } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const [activeSection, setActiveSection] = useState<Section>('nav');
  const [feedbackKey, setFeedbackKey] = useState(0);

  // Edit name dialog
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
                  </Box>
                  <IconButton size="small" onClick={handleOpenNameDialog}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
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
              </List>

              {/* Version footer + dark mode toggle */}
              <Box sx={{ mt: 'auto' }}>
                <Divider />
                <ListItemButton onClick={toggleColorMode} sx={{ py: 1 }}>
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
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', py: 1.5 }}>
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

              {/* Section content */}
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {activeSection === 'favorites' && <FavoritesList onNavigate={handleClose} />}
                {activeSection === 'comments' && <CommentsList onNavigate={handleClose} />}
                {activeSection === 'ratings' && <RatingsList onNavigate={handleClose} />}
                {activeSection === 'feedback' && <FeedbackForm key={feedbackKey} />}
                {activeSection === 'stats' && <StatsView />}
              </Box>
            </>
          )}
        </Box>
      </Drawer>

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
            inputProps={{ maxLength: 30 }}
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
