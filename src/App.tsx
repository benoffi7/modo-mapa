import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { APIProvider } from '@vis.gl/react-google-maps';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { MapProvider } from './context/MapContext';
import ErrorBoundary from './components/layout/ErrorBoundary';
import AppShell from './components/layout/AppShell';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function AdminFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
      <CircularProgress />
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
            <Route
              path="/*"
              element={
                <MapProvider>
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <AppShell />
                  </APIProvider>
                </MapProvider>
              }
            />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
