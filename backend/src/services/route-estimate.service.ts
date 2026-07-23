import axios from 'axios';
import { redis }          from '../config/redis.js';
import { getIntegration } from './config.service.js';
import { logger }         from '../config/logger.js';

// İki nokta arası tahmini sürüş süresi (dakika). OSRM'den alır; başarısızsa
// haversine mesafe / ortalama hız ile tahmin eder. Sonucu Redis'te cache'ler.
// Çakışma penceresinin otomatik hesabında kullanılır (elle "araç dönüş süresi" yerine).

const CACHE_TTL = 24 * 3600; // 1 gün — güzergahlar sabit
const AVG_SPEED_KMH = 60;    // OSRM yoksa varsayılan ortalama hız

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function osrmBaseUrl(): Promise<string> {
  // Admin 'osm' entegrasyonunda özel OSRM tanımlıysa onu kullan; yoksa public demo
  const cfg = await getIntegration('osm');
  const url = (cfg?.config?.osrmUrl as string | undefined)?.trim();
  return url && /^https?:\/\//.test(url) ? url.replace(/\/$/, '') : 'https://router.project-osrm.org';
}

/**
 * Tahmini yolculuk süresini dakika olarak döndürür. Koordinat eksikse null.
 */
export async function estimateDurationMin(
  fromLat: number | null | undefined,
  fromLng: number | null | undefined,
  toLat: number | null | undefined,
  toLng: number | null | undefined,
): Promise<number | null> {
  if (fromLat == null || fromLng == null || toLat == null || toLng == null) return null;

  const key = `route-est:${fromLat.toFixed(4)},${fromLng.toFixed(4)}:${toLat.toFixed(4)},${toLng.toFixed(4)}`;
  const cached = await redis.get(key);
  if (cached) return Number(cached);

  let minutes: number | null = null;

  // 1) OSRM
  try {
    const base = await osrmBaseUrl();
    const url = `${base}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const { data } = await axios.get<{ routes?: { duration?: number }[] }>(url, { timeout: 8_000 });
    const sec = data?.routes?.[0]?.duration;
    if (typeof sec === 'number' && sec > 0) minutes = Math.round(sec / 60);
  } catch (err) {
    logger.warn({ err }, 'OSRM süre tahmini alınamadı; haversine fallback');
  }

  // 2) Fallback: haversine / ortalama hız (+%25 gerçek yol payı)
  if (minutes == null) {
    const km = haversineKm(fromLat, fromLng, toLat, toLng) * 1.25;
    minutes = Math.max(5, Math.round((km / AVG_SPEED_KMH) * 60));
  }

  await redis.setex(key, CACHE_TTL, String(minutes));
  return minutes;
}
