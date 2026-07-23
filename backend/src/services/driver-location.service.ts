import { redis }  from '../config/redis.js';
import { prisma } from '../config/database.js';

// ─── Redis key schema ────────────────────────────────────────────────────────
// driver:loc:{assignmentId} → JSON { lat, lng, heading, speed, ts }  TTL 120s
// Konum geçici veri — DB'ye yazılmaz, yalnızca Redis'te yaşar.

const KEY_PREFIX = 'driver:loc:';
const TTL_SEC    = 120; // 2 dakika güncelleme gelmezse otomatik silinir

export interface DriverLocationData {
  lat:      number;
  lng:      number;
  heading:  number | null; // derece, 0–360
  speed:    number | null; // m/s
  ts:       number;        // unix ms
}

export async function saveDriverLocation(
  assignmentId: string,
  data: Omit<DriverLocationData, 'ts'>,
): Promise<void> {
  const payload: DriverLocationData = {
    ...data,
    ts: Date.now(),
  };
  await redis.set(
    KEY_PREFIX + assignmentId,
    JSON.stringify(payload),
    'EX',
    TTL_SEC,
  );
}

export async function getDriverLocation(
  assignmentId: string,
): Promise<DriverLocationData | null> {
  const raw = await redis.get(KEY_PREFIX + assignmentId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriverLocationData;
  } catch {
    return null;
  }
}

// Booking ID'den aktif assignment'ı bulup konumu döner (müşteri tracking için)
export async function getTrackingInfo(identifier: string) {
  const assignment = await prisma.driverAssignment.findFirst({
    where: {
      OR: [
        { bookingId: identifier },
        { booking: { bookingRef: identifier } },
      ],
    },
    include: {
      booking: {
        include: {
          fromLocation: { select: { name: true, lat: true, lng: true } },
          toLocation:   { select: { name: true, lat: true, lng: true } },
          flightInfo:   { select: { status: true, delayMinutes: true, estimatedAt: true } },
        },
      },
      vehicleClass: { select: { name: true } },
    },
  });

  if (!assignment) return null;

  const b = assignment.booking;

  // Konum yalnızca aktif durumlarda döner
  let location: DriverLocationData | null = null;
  if (['EN_ROUTE', 'PICKED_UP'].includes(assignment.status)) {
    location = await getDriverLocation(assignment.id);
  }

  // Şoför adını çek (minimal)
  const driver = await prisma.user.findUnique({
    where:  { id: assignment.driverId },
    select: { firstName: true },
  });

  return {
    bookingRef:    b.bookingRef,
    status:        assignment.status,
    bookingStatus: b.status,
    vehiclePlate:  assignment.vehiclePlate,
    vehicleClass:  assignment.vehicleClass?.name ?? null,
    driverName:    driver?.firstName ?? null,
    transferDate:  b.transferDate,
    fromLocation:  b.fromLocation,
    toLocation:    b.toLocation,
    flightInfo:    b.flightInfo,
    location,
  };
}
