import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Şoför Canlı Konum Hook'u ────────────────────────────────────────────────
//
// EN_ROUTE veya PICKED_UP durumundayken Geolocation.watchPosition ile GPS'i
// izler ve her SEND_INTERVAL ms'de bir backend'e gönderir.
// isActive=false veya component unmount olunca temizlenir.

const SEND_INTERVAL = 10_000; // 10 saniye

export type LocationStatus = 'idle' | 'watching' | 'denied' | 'unavailable' | 'error';

export function useDriverLocation(assignmentId: string | null, isActive: boolean) {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const watchRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPos = useRef<{ lat: number; lng: number; heading: number | null; speed: number | null } | null>(null);

  const stopWatch = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    latestPos.current = null;
  }, []);

  useEffect(() => {
    if (!isActive || !assignmentId) {
      stopWatch();
      setStatus('idle');
      return;
    }

    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }

    // GPS izlemeyi başlat
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latestPos.current = {
          lat:     pos.coords.latitude,
          lng:     pos.coords.longitude,
          heading: pos.coords.heading,
          speed:   pos.coords.speed,
        };
        setStatus('watching');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
        } else {
          setStatus('error');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge:         5_000,
        timeout:            15_000,
      },
    );
    watchRef.current = watchId;

    // Periyodik gönderim
    const sendLocation = async () => {
      const p = latestPos.current;
      if (!p || !assignmentId) return;
      try {
        await api.put(`/driver/assignments/${assignmentId}/location`, p);
      } catch {
        // Sessizce yut — ağ hatası geçici olabilir
      }
    };

    // İlk gönderim anında + sonra her 10 sn
    sendLocation();
    const timer = setInterval(sendLocation, SEND_INTERVAL);
    timerRef.current = timer;

    return () => {
      stopWatch();
    };
  }, [isActive, assignmentId, stopWatch]);

  const sendManualLocation = useCallback(async (lat: number, lng: number, heading = 0) => {
    if (!assignmentId) return false;
    try {
      await api.put(`/driver/assignments/${assignmentId}/location`, {
        lat,
        lng,
        heading,
        speed: 10,
      });
      setStatus('watching');
      return true;
    } catch {
      return false;
    }
  }, [assignmentId]);

  return { status, sendManualLocation };
}
