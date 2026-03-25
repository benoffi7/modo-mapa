import { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import { useAuth } from '../../context/AuthContext';
import DashboardOverview from './DashboardOverview';
import ActivityFeed from './ActivityFeed';
import FirebaseUsage from './FirebaseUsage';
import AbuseAlerts from './AbuseAlerts';
import FeedbackList from './FeedbackList';
import TrendsPanel from './TrendsPanel';
import UsersPanel from './UsersPanel';
import BackupsPanel from './BackupsPanel';
import PhotoReviewPanel from './PhotoReviewPanel';
import PerformancePanel from './PerformancePanel';
import FeaturesPanel from './FeaturesPanel';
import FeaturedListsPanel from './FeaturedListsPanel';
import NotificationsPanel from './NotificationsPanel';
import SocialPanel from './SocialPanel';

export default function AdminLayout() {
  const [tab, setTab] = useState(0);
  const [alertsPendingCount, setAlertsPendingCount] = useState(0);
  const { signOut } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Modo Mapa — Admin
          </Typography>
          <Button color="inherit" onClick={signOut}>
            Cerrar sesión
          </Button>
        </Toolbar>
      </AppBar>
      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
        <Tab label="Resumen" />
        <Tab label="Actividad" />
        <Tab label="Feedback" />
        <Tab label="Tendencias" />
        <Tab label="Usuarios" />
        <Tab label="Social" />
        <Tab label="Uso Firebase" />
        <Tab label={
          <Badge badgeContent={alertsPendingCount} color="error" max={99}>
            Alertas
          </Badge>
        } />
        <Tab label="Backups" />
        <Tab label="Fotos" />
        <Tab label="Listas" />
        <Tab label="Rendimiento" />
        <Tab label="Funcionalidades" />
        <Tab label="Notificaciones" />
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {tab === 0 && <DashboardOverview />}
        {tab === 1 && <ActivityFeed />}
        {tab === 2 && <FeedbackList />}
        {tab === 3 && <TrendsPanel />}
        {tab === 4 && <UsersPanel />}
        {tab === 5 && <SocialPanel />}
        {tab === 6 && <FirebaseUsage />}
        {tab === 7 && <AbuseAlerts onPendingCount={setAlertsPendingCount} />}
        {tab === 8 && <BackupsPanel />}
        {tab === 9 && <PhotoReviewPanel />}
        {tab === 10 && <FeaturedListsPanel />}
        {tab === 11 && <PerformancePanel />}
        {tab === 12 && <FeaturesPanel />}
        {tab === 13 && <NotificationsPanel />}
      </Box>
    </Box>
  );
}
