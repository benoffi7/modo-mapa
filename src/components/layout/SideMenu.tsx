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
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import { useAuth } from '../../context/AuthContext';
import FavoritesList from '../menu/FavoritesList';
import CommentsList from '../menu/CommentsList';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Section = 'nav' | 'favorites' | 'comments';

export default function SideMenu({ open, onClose }: Props) {
  const { displayName, setDisplayName } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('nav');

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

                <ListItemButton disabled>
                  <ListItemIcon>
                    <FeedbackOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary="Feedback" secondary="Próximamente" />
                </ListItemButton>
              </List>
            </>
          ) : (
            <>
              {/* Section header with back button */}
              <Toolbar variant="dense" sx={{ gap: 1 }}>
                <IconButton edge="start" onClick={() => setActiveSection('nav')}>
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {activeSection === 'favorites' ? 'Favoritos' : 'Comentarios'}
                </Typography>
              </Toolbar>
              <Divider />

              {/* Section content */}
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {activeSection === 'favorites' && <FavoritesList onNavigate={handleClose} />}
                {activeSection === 'comments' && <CommentsList onNavigate={handleClose} />}
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
