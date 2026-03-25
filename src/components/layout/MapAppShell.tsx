import { APIProvider } from '@vis.gl/react-google-maps';
import { MapProvider } from '../../context/MapContext';
import AppShell from './AppShell';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function MapAppShell() {
  return (
    <MapProvider>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
        <AppShell />
      </APIProvider>
    </MapProvider>
  );
}
