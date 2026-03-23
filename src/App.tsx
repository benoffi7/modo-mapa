import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { APIProvider } from '@vis.gl/react-google-maps';
import { ColorModeProvider } from './context/ColorModeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ToastProvider } from './context/ToastContext';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { MapProvider } from './context/MapContext';
import ErrorBoundary from './components/layout/ErrorBoundary';
import AppShell from './components/layout/AppShell';
import { useScreenTracking } from './hooks/useScreenTracking';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ThemePlayground = lazy(() => import('./pages/ThemePlayground'));
const ConstantsDashboard = lazy(() => import('./pages/ConstantsDashboard'));

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function AdminFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
      <CircularProgress />
    </Box>
  );
}

function App() {
  useScreenTracking();

  return (
    <ColorModeProvider>
      <ErrorBoundary>
        <AuthProvider>
        <ToastProvider>
        <ConnectivityProvider>
        <NotificationsProvider>
          <Routes>
            {import.meta.env.DEV && (
              <>
                <Route
                  path="/dev/theme"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <ThemePlayground />
                    </Suspense>
                  }
                />
                <Route
                  path="/dev/constants"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <ConstantsDashboard />
                    </Suspense>
                  }
                />
              </>
            )}
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
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
                    <AppShell />
                  </APIProvider>
                </MapProvider>
              }
            />
          </Routes>
        </NotificationsProvider>
        </ConnectivityProvider>
        </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ColorModeProvider>
  );
}

export default App;
