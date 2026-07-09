import axios             from 'axios';
import { prisma }        from '../config/database.js';
import { getIntegration } from './config.service.js';
import { queueNotification } from './notification.service.js';
import { logger }        from '../config/logger.js';
import type { FlightStatus } from '@prisma/client';

// ─── Normalleştirilmiş uçuş verisi ───────────────────────────────────────────

interface FlightData {
  status:       FlightStatus;
  scheduledAt:  Date;
  estimatedAt:  Date | null;
  actualAt:     Date | null;
  delayMinutes: number;
}

// ─── AeroDataBox yanıtı ───────────────────────────────────────────────────────

interface AeroDataBoxFlight {
  status?: string;
  arrival?: {
    scheduledTime?: { utc?: string };
    revisedTime?:   { utc?: string };
    actualTime?:    { utc?: string };
  };
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

  return { status, scheduledAt, estimatedAt, actualAt, delayMinutes };
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
    // Gelecekte: flightAware, aviationStack vb.
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
    },
    update: {
      estimatedAt:  data.estimatedAt,
      actualAt:     data.actualAt,
      status:       data.status,
      delayMinutes: data.delayMinutes,
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
