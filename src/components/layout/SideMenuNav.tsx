import { List, ListItemButton, ListItemIcon, ListItemText, Badge, Divider } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import BarChartIcon from '@mui/icons-material/BarChart';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import HistoryIcon from '@mui/icons-material/History';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CasinoIcon from '@mui/icons-material/Casino';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { ADD_BUSINESS_URL, RANKINGS_COLOR, STATS_COLOR } from '../../constants/ui';
import type { Section } from './SideMenu';

interface Props {
  isAuthenticated: boolean;
  unreadReplyCount: number;
  onNavigate: (section: Section) => void;
  onSurprise: () => void;
  onFeedback: () => void;
}

export default function SideMenuNav({ isAuthenticated, unreadReplyCount, onNavigate, onSurprise, onFeedback }: Props) {
  return (
    <>
      <List>
        <ListItemButton onClick={() => onNavigate('favorites')}>
          <ListItemIcon><FavoriteIcon sx={{ color: 'error.main' }} /></ListItemIcon>
          <ListItemText primary="Favoritos" />
        </ListItemButton>

        {isAuthenticated && (
          <ListItemButton onClick={() => onNavigate('lists')}>
            <ListItemIcon><BookmarkBorderIcon sx={{ color: 'info.main' }} /></ListItemIcon>
            <ListItemText primary="Mis Listas" />
          </ListItemButton>
        )}

        <ListItemButton onClick={() => onNavigate('recent')}>
          <ListItemIcon><HistoryIcon sx={{ color: 'warning.main' }} /></ListItemIcon>
          <ListItemText primary="Recientes" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('suggestions')}>
          <ListItemIcon><LightbulbOutlinedIcon sx={{ color: 'warning.light' }} /></ListItemIcon>
          <ListItemText primary="Sugeridos" />
        </ListItemButton>

        <ListItemButton onClick={onSurprise}>
          <ListItemIcon><CasinoIcon sx={{ color: 'secondary.main' }} /></ListItemIcon>
          <ListItemText primary="Sorpréndeme" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('comments')}>
          <ListItemIcon>
            <Badge badgeContent={unreadReplyCount} color="error" max={9}>
              <ChatBubbleOutlineIcon sx={{ color: 'primary.main' }} />
            </Badge>
          </ListItemIcon>
          <ListItemText primary="Comentarios" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('ratings')}>
          <ListItemIcon><StarOutlineIcon sx={{ color: 'warning.light' }} /></ListItemIcon>
          <ListItemText primary="Calificaciones" />
        </ListItemButton>

        <ListItemButton onClick={onFeedback}>
          <ListItemIcon><FeedbackOutlinedIcon sx={{ color: 'success.main' }} /></ListItemIcon>
          <ListItemText primary="Feedback" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('rankings')}>
          <ListItemIcon><LeaderboardIcon sx={{ color: RANKINGS_COLOR }} /></ListItemIcon>
          <ListItemText primary="Rankings" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('stats')}>
          <ListItemIcon><BarChartIcon sx={{ color: STATS_COLOR }} /></ListItemIcon>
          <ListItemText primary="Estadísticas" />
        </ListItemButton>
      </List>

      <Divider />

      <List>
        <ListItemButton onClick={() => window.open(ADD_BUSINESS_URL, '_blank')}>
          <ListItemIcon><AddBusinessIcon sx={{ color: 'text.secondary' }} /></ListItemIcon>
          <ListItemText primary="Agregar comercio" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('settings')}>
          <ListItemIcon><SettingsOutlinedIcon sx={{ color: 'text.secondary' }} /></ListItemIcon>
          <ListItemText primary="Configuración" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('help')}>
          <ListItemIcon><HelpOutlineIcon sx={{ color: 'text.secondary' }} /></ListItemIcon>
          <ListItemText primary="Ayuda" />
        </ListItemButton>
      </List>
    </>
  );
}
