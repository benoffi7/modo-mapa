import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { ColorModeProvider } from './context/ColorModeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ToastProvider } from './context/ToastContext';
import { ConnectivityProvider } from './context/ConnectivityContext';
import ErrorBoundary from './components/layout/ErrorBoundary';
import { useScreenTracking } from './hooks/useScreenTracking';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ThemePlayground = lazy(() => import('./pages/ThemePlayground'));
const ConstantsDashboard = lazy(() => import('./pages/ConstantsDashboard'));
const MapAppShell = lazy(() => import('./components/layout/MapAppShell'));

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
                <Suspense fallback={<AdminFallback />}>
                  <MapAppShell />
                </Suspense>
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
