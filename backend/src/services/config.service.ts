import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { decrypt } from '../utils/crypto.js';

const CACHE_TTL = 300; // 5 dakika

export type ServiceKey =
  | 'paytr' | 'bank_transfer' | 'cash' | 'flight' | 'map'
  | 'sms'   | 'whatsapp' | 'smtp' | 'exchange' | 'aeroDataBox' | 'netgsm' | 'osm' | 'exchangeRate';

interface IntegrationConfig {
  provider: string;
  config:   Record<string, unknown>;  // şifresiz
  secrets:  Record<string, string>;   // çözülmüş anahtarlar
  isActive: boolean;
}

export async function getIntegration(service: ServiceKey): Promise<IntegrationConfig | null> {
  const cacheKey = `integration:${service}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as IntegrationConfig;

  const row = await prisma.integrationSetting.findUnique({ where: { service } });
  if (!row || !row.isActive) return null;

  const result: IntegrationConfig = {
    provider: row.provider,
    config:   row.configJson ? JSON.parse(row.configJson) as Record<string, unknown> : {},
    secrets:  row.secretJson ? JSON.parse(decrypt(row.secretJson)) as Record<string, string> : {},
    isActive: row.isActive,
  };

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  return result;
}

export async function invalidateIntegrationCache(service: ServiceKey) {
  await redis.del(`integration:${service}`);
}
