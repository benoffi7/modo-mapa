import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSetUserLocation, mockGetCurrentPosition } = vi.hoisted(() => ({
  mockSetUserLocation: vi.fn(),
  mockGetCurrentPosition: vi.fn(),
}));

let mockUserLocation: { lat: number; lng: number } | null = null;

vi.mock('../context/FiltersContext', () => ({
  useFilters: () => ({
    userLocation: mockUserLocation,
    setUserLocation: mockSetUserLocation,
  }),
}));

import { useUserLocation } from './useUserLocation';

describe('useUserLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserLocation = null;
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes userLocation from FiltersContext', () => {
    mockUserLocation = { lat: -34.6, lng: -58.4 };
    const { result } = renderHook(() => useUserLocation());
    expect(result.current.userLocation).toEqual({ lat: -34.6, lng: -58.4 });
  });

  it('sets error and does NOT call getCurrentPosition when geolocation unsupported', () => {
    vi.stubGlobal('navigator', {});

    const { result } = renderHook(() => useUserLocation());

    act(() => {
      result.current.requestLocation();
    });

    expect(result.current.error).toBe('Geolocalización no soportada por tu navegador');
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.isLocating).toBe(false);
  });

  it('on success, calls setUserLocation with lat/lng and resets isLocating', () => {
    mockGetCurrentPosition.mockImplementation((onSuccess: PositionCallback) => {
      onSuccess({
        coords: { latitude: -34.5, longitude: -58.5 },
      } as GeolocationPosition);
    });

    const { result } = renderHook(() => useUserLocation());

    act(() => {
      result.current.requestLocation();
    });

    expect(mockSetUserLocation).toHaveBeenCalledWith({ lat: -34.5, lng: -58.5 });
    expect(result.current.isLocating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('on error.code === 1 (PERMISSION_DENIED), shows "Permiso de ubicación denegado"', () => {
    mockGetCurrentPosition.mockImplementation(
      (_onSuccess: PositionCallback, onError?: PositionErrorCallback) => {
        onError?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      },
    );

    const { result } = renderHook(() => useUserLocation());

    act(() => {
      result.current.requestLocation();
    });

    expect(result.current.error).toBe('Permiso de ubicación denegado');
    expect(result.current.isLocating).toBe(false);
    expect(mockSetUserLocation).not.toHaveBeenCalled();
  });

  it('on generic error (code !== 1), shows "No se pudo obtener tu ubicación"', () => {
    mockGetCurrentPosition.mockImplementation(
      (_onSuccess: PositionCallback, onError?: PositionErrorCallback) => {
        onError?.({ code: 2, message: 'position unavailable' } as GeolocationPositionError);
      },
    );

    const { result } = renderHook(() => useUserLocation());

    act(() => {
      result.current.requestLocation();
    });

    expect(result.current.error).toBe('No se pudo obtener tu ubicación');
    expect(result.current.isLocating).toBe(false);
  });

  it('clears prior error when starting a new request', () => {
    // First call: error
    mockGetCurrentPosition.mockImplementationOnce(
      (_onSuccess: PositionCallback, onError?: PositionErrorCallback) => {
        onError?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      },
    );

    const { result } = renderHook(() => useUserLocation());

    act(() => {
      result.current.requestLocation();
    });
    expect(result.current.error).toBe('Permiso de ubicación denegado');

    // Second call: success — error should be cleared
    mockGetCurrentPosition.mockImplementationOnce((onSuccess: PositionCallback) => {
      onSuccess({
        coords: { latitude: 0, longitude: 0 },
      } as GeolocationPosition);
    });

    act(() => {
      result.current.requestLocation();
    });

    expect(result.current.error).toBeNull();
  });
});
