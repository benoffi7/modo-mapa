import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { APIProvider } from '@vis.gl/react-google-maps';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { MapProvider } from './context/MapContext';
import ErrorBoundary from './components/layout/ErrorBoundary';
import AppShell from './components/layout/AppShell';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <MapProvider>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <AppShell />
            </APIProvider>
          </MapProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
