import { lazy, Suspense, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import { useAuth } from '../../context/AuthContext';
// Eager: paneles sin recharts.
import DashboardOverview from './DashboardOverview';
import ActivityFeed from './ActivityFeed';
import AbuseAlerts from './AbuseAlerts';
import FeedbackList from './FeedbackList';
import UsersPanel from './UsersPanel';
import BackupsPanel from './BackupsPanel';
import PhotoReviewPanel from './PhotoReviewPanel';
import FeaturedListsPanel from './FeaturedListsPanel';
import NotificationsPanel from './NotificationsPanel';
import SocialPanel from './SocialPanel';
import SpecialsPanel from './SpecialsPanel';
import AchievementsPanel from './AchievementsPanel';
import ConfigPanel from './ConfigPanel';
import DeletionAuditPanel from './audit/DeletionAuditPanel';

// Lazy: paneles que importan recharts (~60-80KB gzip combinado).
// Solo se bajan cuando el admin hace click en ese tab.
const TrendsPanel = lazy(() => import('./TrendsPanel'));
const FirebaseUsage = lazy(() => import('./FirebaseUsage'));
const PerformancePanel = lazy(() => import('./PerformancePanel'));
const FeaturesPanel = lazy(() => import('./FeaturesPanel'));

function AdminPanelLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

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
        <Tab label="Especiales" />
        <Tab label="Logros" />
        <Tab label="Configuración" />
        <Tab label="Auditorías" />
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {tab === 0 && <DashboardOverview />}
        {tab === 1 && <ActivityFeed />}
        {tab === 2 && <FeedbackList />}
        <Suspense fallback={<AdminPanelLoader />}>
          {tab === 3 && <TrendsPanel />}
          {tab === 6 && <FirebaseUsage />}
          {tab === 11 && <PerformancePanel />}
          {tab === 12 && <FeaturesPanel />}
        </Suspense>
        {tab === 4 && <UsersPanel />}
        {tab === 5 && <SocialPanel />}
        {tab === 7 && <AbuseAlerts onPendingCount={setAlertsPendingCount} />}
        {tab === 8 && <BackupsPanel />}
        {tab === 9 && <PhotoReviewPanel />}
        {tab === 10 && <FeaturedListsPanel />}
        {tab === 13 && <NotificationsPanel />}
        {tab === 14 && <SpecialsPanel />}
        {tab === 15 && <AchievementsPanel />}
        {tab === 16 && <ConfigPanel />}
        {tab === 17 && <DeletionAuditPanel />}
      </Box>
    </Box>
  );
}
