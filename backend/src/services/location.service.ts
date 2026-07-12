import { prisma } from '../config/database.js';
import { redis }  from '../config/redis.js';

const CACHE_KEY        = 'locations:all';
const ROUTES_CACHE_KEY = 'routes:available';
const CACHE_TTL        = 3600; // 1 saat

export async function getLocations() {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return JSON.parse(cached) as Awaited<ReturnType<typeof fetchFromDb>>;

  const data = await fetchFromDb();
  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
  return data;
}

function fetchFromDb() {
  return prisma.location.findMany({
    where:   { isActive: true },
    select:  { id: true, name: true, nameEn: true, type: true, lat: true, lng: true },
    orderBy: { name: 'asc' },
  });
}

export async function invalidateLocationsCache() {
  await redis.del(CACHE_KEY);
}

// ─── Fiyatlı güzergahlar ──────────────────────────────────────────────────────

export async function getAvailableRoutes() {
  const cached = await redis.get(ROUTES_CACHE_KEY);
  if (cached) return JSON.parse(cached) as { fromLocationId: string; toLocationId: string }[];

  const pairs = await prisma.priceMatrix.findMany({
    where: {
      isActive:     true,
      fromLocation: { isActive: true },
      toLocation:   { isActive: true },
    },
    select:   { fromLocationId: true, toLocationId: true },
    distinct: ['fromLocationId', 'toLocationId'],
  });

  await redis.setex(ROUTES_CACHE_KEY, CACHE_TTL, JSON.stringify(pairs));
  return pairs;
}

export async function invalidateRoutesCache() {
  await redis.del(ROUTES_CACHE_KEY);
}
