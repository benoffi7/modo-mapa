import { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useAuth } from '../../context/AuthContext';
import DashboardOverview from './DashboardOverview';
import ActivityFeed from './ActivityFeed';
import FirebaseUsage from './FirebaseUsage';
import AbuseAlerts from './AbuseAlerts';
import FeedbackList from './FeedbackList';
import TrendsPanel from './TrendsPanel';

export default function AdminLayout() {
  const [tab, setTab] = useState(0);
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
      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label="Overview" />
        <Tab label="Actividad" />
        <Tab label="Feedback" />
        <Tab label="Tendencias" />
        <Tab label="Firebase Usage" />
        <Tab label="Alertas" />
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {tab === 0 && <DashboardOverview />}
        {tab === 1 && <ActivityFeed />}
        {tab === 2 && <FeedbackList />}
        {tab === 3 && <TrendsPanel />}
        {tab === 4 && <FirebaseUsage />}
        {tab === 5 && <AbuseAlerts />}
      </Box>
    </Box>
  );
}
