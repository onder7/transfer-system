/**
 * Lokasyon içe aktarma — JSON dosyasından Location tablosuna upsert eder.
 *
 * Kullanım:  npx tsx scripts/import-locations.ts ../Lokasyonlar.json
 *
 * - Eşleştirme anahtarı: name + type (Location'da unique constraint yok, findFirst kullanılır)
 * - Aynı kayıt tekrar gelirse günceller → script tekrar çalıştırılabilir, kopya oluşmaz
 * - Dosya içindeki kopyalar tekilleştirilir (son görülen kazanır)
 * - Geçersiz kayıtlar atlanır ve raporlanır
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/config/database.js';
import { invalidateLocationsCache, invalidateRoutesCache } from '../src/services/location.service.js';

const VALID_TYPES = ['airport', 'hotel', 'region', 'port', 'city'] as const;
type LocType = (typeof VALID_TYPES)[number];

interface Row {
  name: string;
  nameEn?: string | null;
  type: LocType;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  isActive?: boolean;
}

const file = process.argv[2] ?? '../Lokasyonlar.json';
const path = resolve(process.cwd(), file);

const raw = readFileSync(path, 'utf8');
let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error(`❌ JSON ayrıştırılamadı: ${(e as Error).message}`);
  process.exit(1);
}
if (!Array.isArray(parsed)) {
  console.error('❌ Dosya bir dizi (array) olmalı.');
  process.exit(1);
}

// ── Doğrula + tekilleştir ────────────────────────────────────────────────────
const skipped: string[] = [];
const unique = new Map<string, Row>();

parsed.forEach((r: any, i: number) => {
  const label = `[${i}] ${r?.name ?? '(isimsiz)'}`;
  if (!r?.name || String(r.name).trim().length < 2) return void skipped.push(`${label}: name eksik/kısa`);
  if (!VALID_TYPES.includes(r.type)) return void skipped.push(`${label}: geçersiz type=${JSON.stringify(r.type)}`);
  if (r.lat != null && typeof r.lat !== 'number') return void skipped.push(`${label}: lat sayı değil`);
  if (r.lng != null && typeof r.lng !== 'number') return void skipped.push(`${label}: lng sayı değil`);

  const row: Row = {
    name:     String(r.name).trim(),
    nameEn:   r.nameEn ? String(r.nameEn).trim() : null,
    type:     r.type,
    address:  r.address ? String(r.address).trim() : null,
    lat:      r.lat ?? null,
    lng:      r.lng ?? null,
    isActive: r.isActive ?? true,
  };
  unique.set(`${row.name.toLowerCase()}|${row.type}`, row);
});

console.log(`📄 ${path}`);
console.log(`   ${parsed.length} kayıt okundu → ${unique.size} benzersiz, ${skipped.length} atlandı`);
if (skipped.length) console.log('   Atlananlar:\n     - ' + skipped.join('\n     - '));

// ── Upsert ───────────────────────────────────────────────────────────────────
let created = 0;
let updated = 0;

for (const row of unique.values()) {
  const existing = await prisma.location.findFirst({
    where: { name: row.name, type: row.type },
    select: { id: true },
  });

  if (existing) {
    await prisma.location.update({ where: { id: existing.id }, data: row });
    updated++;
  } else {
    await prisma.location.create({ data: row });
    created++;
  }
}

await invalidateLocationsCache();
await invalidateRoutesCache();

const total = await prisma.location.count();
const byType = await prisma.location.groupBy({ by: ['type'], _count: { _all: true } });

console.log(`\n✅ Tamamlandı — ${created} yeni, ${updated} güncellendi`);
console.log(`   Tablodaki toplam lokasyon: ${total}`);
byType.forEach((t) => console.log(`     ${t.type}: ${t._count._all}`));
console.log('   Redis cache temizlendi (locations:all, routes:available)');

process.exit(0);
