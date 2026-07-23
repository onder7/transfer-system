import axios             from 'axios';
import { prisma }        from '../config/database.js';
import { getIntegration } from './config.service.js';
import { queueNotification } from './notification.service.js';
import { logger }        from '../config/logger.js';
import type { FlightStatus } from '@prisma/client';

// ─── Normalleştirilmiş uçuş verisi ───────────────────────────────────────────

interface RouteInfo {
  depIata:      string | null;
  depName:      string | null;
  depUtcOffset: string | null;
  arrIata:      string | null;
  arrName:      string | null;
  arrUtcOffset: string | null;
}

interface FlightData {
  status:       FlightStatus;
  scheduledAt:  Date;
  estimatedAt:  Date | null;
  actualAt:     Date | null;
  delayMinutes: number;
  route:        RouteInfo | null;
}

// Yerel saat string'inden UTC offset çıkar: "2026-07-25 18:10+03:00" → "+03:00"
function offsetFromLocal(local?: string): string | null {
  const m = local?.match(/([+-]\d{2}:\d{2})$/);
  return m ? m[1] : null;
}

// Yerel + UTC saatlerinden offset hesapla (AirLabs): "YYYY-MM-DD HH:mm"
function offsetFromLocalUtc(local?: string, utc?: string): string | null {
  if (!local || !utc) return null;
  const l = new Date(`${local.replace(' ', 'T')}:00Z`).getTime();
  const u = new Date(`${utc.replace(' ', 'T')}:00Z`).getTime();
  if (isNaN(l) || isNaN(u)) return null;
  const mins = Math.round((l - u) / 60_000);
  const sign = mins >= 0 ? '+' : '-';
  const a = Math.abs(mins);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

// ─── AeroDataBox yanıtı ───────────────────────────────────────────────────────

interface AeroDataBoxPoint {
  airport?: { iata?: string; name?: string; shortName?: string; municipalityName?: string };
  scheduledTime?: { utc?: string; local?: string };
  revisedTime?:   { utc?: string };
  actualTime?:    { utc?: string };
}

interface AeroDataBoxFlight {
  status?:    string;
  departure?: AeroDataBoxPoint;
  arrival?:   AeroDataBoxPoint;
}

function parseAeroDataBoxStatus(s?: string): FlightStatus {
  switch (s) {
    case 'Arrived':   return 'LANDED';
    case 'Delayed':   return 'DELAYED';
    case 'Cancelled': return 'CANCELLED';
    default:          return 'SCHEDULED';
  }
}

async function fetchAeroDataBox(
  flightNumber: string,
  date: string,           // YYYY-MM-DD
  apiKey: string,
): Promise<FlightData | null> {
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightNumber}/${date}`;

  const { data } = await axios.get<AeroDataBoxFlight[]>(url, {
    headers: {
      'X-RapidAPI-Key':  apiKey,
      'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
    },
    params: { withAircraftImage: false, withLocation: false },
    timeout: 10_000,
  });

  const flight = data?.[0];
  if (!flight) return null;

  const scheduledAt = new Date(flight.arrival?.scheduledTime?.utc ?? '');
  const estimatedAt = flight.arrival?.revisedTime?.utc
    ? new Date(flight.arrival.revisedTime.utc)
    : null;
  const actualAt = flight.arrival?.actualTime?.utc
    ? new Date(flight.arrival.actualTime.utc)
    : null;

  const delayMs = estimatedAt && !isNaN(scheduledAt.getTime())
    ? estimatedAt.getTime() - scheduledAt.getTime()
    : 0;
  const delayMinutes = Math.max(0, Math.round(delayMs / 60_000));

  const status = parseAeroDataBoxStatus(flight.status) === 'SCHEDULED' && delayMinutes > 15
    ? 'DELAYED'
    : parseAeroDataBoxStatus(flight.status);

  const apName = (p?: AeroDataBoxPoint) =>
    p?.airport?.municipalityName ?? p?.airport?.shortName ?? p?.airport?.name ?? null;
  const route: RouteInfo = {
    depIata:      flight.departure?.airport?.iata ?? null,
    depName:      apName(flight.departure),
    depUtcOffset: offsetFromLocal(flight.departure?.scheduledTime?.local),
    arrIata:      flight.arrival?.airport?.iata ?? null,
    arrName:      apName(flight.arrival),
    arrUtcOffset: offsetFromLocal(flight.arrival?.scheduledTime?.local),
  };

  return { status, scheduledAt, estimatedAt, actualAt, delayMinutes, route };
}

// ─── AirLabs yanıtı ───────────────────────────────────────────────────────────

interface AirLabsFlight {
  status?:            string; // scheduled | active | landed | cancelled
  arr_time_utc?:      string; // "YYYY-MM-DD HH:mm" (UTC)
  arr_estimated_utc?: string;
  arr_actual_utc?:    string;
  delayed?:           number; // dakika
  dep_iata?:          string;
  dep_name?:          string; // kalkış şehri/havalimanı
  dep_time?:          string; // yerel
  dep_time_utc?:      string;
  arr_iata?:          string;
  arr_name?:          string;
  arr_time?:          string; // yerel
}

function parseAirLabsStatus(s?: string): FlightStatus {
  switch (s) {
    case 'landed':    return 'LANDED';
    case 'cancelled': return 'CANCELLED';
    // 'active' = uçuşta, 'scheduled' = planlandı → henüz inmedi
    default:          return 'SCHEDULED';
  }
}

// AirLabs UTC formatı "2026-07-25 18:10" → Date
function parseAirLabsDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s.replace(' ', 'T')}:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchAirLabs(
  flightNumber: string,
  apiKey: string,
): Promise<FlightData | null> {
  // AirLabs /flight gerçek-zamanlı tek uçuş döndürür (tarih parametresi almaz).
  // Uçuş no IATA (TK2412) veya ICAO (THY2412) olabilir; ikisini de deneriz.
  const url = 'https://airlabs.co/api/v9/flight';
  const key = flightNumber.replace(/\s+/g, '').toUpperCase();
  const param = /^[A-Z]{3}/.test(key) ? 'flight_icao' : 'flight_iata';

  const { data } = await axios.get<{ response?: AirLabsFlight; error?: unknown }>(url, {
    params: { [param]: key, api_key: apiKey },
    timeout: 10_000,
  });

  const f = data?.response;
  if (!f || !f.arr_time_utc) return null;

  const scheduledAt = parseAirLabsDate(f.arr_time_utc) ?? new Date(NaN);
  const estimatedAt = parseAirLabsDate(f.arr_estimated_utc);
  const actualAt    = parseAirLabsDate(f.arr_actual_utc);
  const delayMinutes = Math.max(0, Math.round(f.delayed ?? 0));

  const base   = parseAirLabsStatus(f.status);
  const status = base === 'SCHEDULED' && delayMinutes > 15 ? 'DELAYED' : base;

  const route: RouteInfo = {
    depIata:      f.dep_iata ?? null,
    depName:      f.dep_name ?? null,
    depUtcOffset: offsetFromLocalUtc(f.dep_time, f.dep_time_utc),
    arrIata:      f.arr_iata ?? null,
    arrName:      f.arr_name ?? null,
    arrUtcOffset: offsetFromLocalUtc(f.arr_time, f.arr_time_utc),
  };

  return { status, scheduledAt, estimatedAt, actualAt, delayMinutes, route };
}

// ─── Uçuş verisi çek (sağlayıcıdan bağımsız) ─────────────────────────────────

export async function fetchFlight(
  flightNumber: string,
  date: string,
): Promise<FlightData | null> {
  const cfg = await getIntegration('flight');
  if (!cfg) return null;

  try {
    if (cfg.provider === 'aeroDataBox') {
      return await fetchAeroDataBox(flightNumber, date, cfg.secrets.apiKey);
    }
    if (cfg.provider === 'airlabs') {
      return await fetchAirLabs(flightNumber, cfg.secrets.apiKey);
    }
    // Gelecekte: flightAware, aviationStack vb.
    logger.warn({ provider: cfg.provider }, 'Bilinmeyen uçuş sağlayıcısı');
    return null;
  } catch (err) {
    logger.warn({ err, flightNumber }, 'Uçuş verisi alınamadı');
    return null;
  }
}

// ─── Tek booking'in uçuş bilgisini güncelle ───────────────────────────────────

export async function updateBookingFlight(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { flightInfo: true },
  });
  if (!booking?.flightNumber) return;

  const date = booking.transferDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const data  = await fetchFlight(booking.flightNumber, date);
  if (!data) return;

  const prevInfo    = booking.flightInfo;
  const wasDelayed  = prevInfo?.status !== 'DELAYED' && data.status === 'DELAYED';

  const routeData = {
    depIata:      data.route?.depIata      ?? null,
    depName:      data.route?.depName      ?? null,
    depUtcOffset: data.route?.depUtcOffset ?? null,
    arrIata:      data.route?.arrIata      ?? null,
    arrName:      data.route?.arrName      ?? null,
    arrUtcOffset: data.route?.arrUtcOffset ?? null,
  };

  await prisma.flightInfo.upsert({
    where:  { bookingId },
    create: {
      bookingId,
      flightNumber: booking.flightNumber,
      scheduledAt:  data.scheduledAt,
      estimatedAt:  data.estimatedAt,
      actualAt:     data.actualAt,
      status:       data.status,
      delayMinutes: data.delayMinutes,
      ...routeData,
    },
    update: {
      flightNumber: booking.flightNumber, // uçuş no değişmişse etiketi de güncelle
      scheduledAt:  data.scheduledAt,
      estimatedAt:  data.estimatedAt,
      actualAt:     data.actualAt,
      status:       data.status,
      delayMinutes: data.delayMinutes,
      ...routeData,
      lastCheckedAt: new Date(),
    },
  });

  // Rötar yeni tespit edildi → şoför + müşteri bildir
  if (wasDelayed && data.delayMinutes > 0) {
    const [driver, assignment] = await Promise.all([
      prisma.driverAssignment.findUnique({
        where:   { bookingId },
        include: { driver: true },
      }),
      Promise.resolve(null),
    ]);

    const message = `✈️ Rötar Bildirimi — ${booking.flightNumber}: ${data.delayMinutes} dk gecikme. Yeni tahmini iniş: ${data.estimatedAt?.toLocaleTimeString('tr-TR') ?? 'belirsiz'}`;

    if (booking.guestPhone) {
      await queueNotification({ bookingId, channel: 'SMS', recipient: booking.guestPhone, body: message });
    }
    if (driver?.driver?.phone) {
      await queueNotification({ bookingId, channel: 'SMS', recipient: driver.driver.phone, body: message });
    }

    logger.info({ bookingId, delayMinutes: data.delayMinutes }, 'Rötar bildirimi gönderildi');
  }
}

// ─── Tüm aktif booking'lerin uçuşlarını güncelle (cron) ────────────────────

export async function checkActiveFlights(): Promise<void> {
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat içindekiler

  const bookings = await prisma.booking.findMany({
    where: {
      flightNumber: { not: null },
      transferDate: { lte: cutoff, gte: new Date() },
      status:       { in: ['CONFIRMED', 'ASSIGNED', 'EN_ROUTE'] },
      OR: [
        { flightInfo: null },
        { flightInfo: { status: { notIn: ['LANDED', 'CANCELLED'] } } },
      ],
    },
    select: { id: true, flightNumber: true },
  });

  logger.info({ count: bookings.length }, 'Uçuş takibi başlatıldı');

  for (const b of bookings) {
    try {
      await updateBookingFlight(b.id);
    } catch (err) {
      logger.warn({ err, bookingId: b.id }, 'Uçuş güncelleme hatası');
    }
  }
}
