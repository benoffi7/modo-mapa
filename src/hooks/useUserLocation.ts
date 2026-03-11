import { useState, useCallback } from 'react';
import { useMapContext } from '../context/MapContext';

export function useUserLocation() {
  const { userLocation, setUserLocation } = useMapContext();
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por tu navegador');
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? 'Permiso de ubicación denegado'
            : 'No se pudo obtener tu ubicación'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setUserLocation]);

  return { userLocation, requestLocation, isLocating, error };
}
