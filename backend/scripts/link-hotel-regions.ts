/**
 * Otelleri bölgelere bağlar (Location.regionId).
 *
 * Kullanım:  npx tsx scripts/link-hotel-regions.ts [--dry]
 *
 * Yöntem: Her bölgenin KENDİ adresinden ilçe anahtarı çıkarılır
 * (ör. "Antalya Şehir Merkezi" → adres "Muratpaşa, Antalya" → anahtar "Muratpaşa").
 * Sonra otel adresinde bu anahtarlar aranır; en ERKEN geçen eşleşme kazanır
 * (adreslerde en özgül yer adı başta gelir: "Kumköy, 07330 Side, Manavgat/Antalya" → Side).
 *
 * Zaten regionId'si olan kayıtlara dokunulmaz (--force ile üzerine yazar).
 */
import { prisma } from '../src/config/database.js';
import { invalidateLocationsCache } from '../src/services/location.service.js';

const DRY   = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

const regions = await prisma.location.findMany({
  where:  { type: 'region' },
  select: { id: true, name: true, address: true },
});

// Bölge → arama anahtarları: hem kendi adı hem adresinin ilk parçası (ilçe)
const keyed = regions.map((r) => {
  const keys = new Set<string>([r.name]);
  const firstPart = r.address?.split(',')[0]?.trim();
  if (firstPart) keys.add(firstPart);
  return { ...r, keys: [...keys].filter((k) => k.length >= 3).map(norm) };
});

console.log('Bölge anahtarları:');
keyed.forEach((r) => console.log(`  ${r.name} → [${r.keys.join(', ')}]`));

const hotels = await prisma.location.findMany({
  where:  { type: 'hotel' },
  select: { id: true, name: true, address: true, regionId: true },
});

let linked = 0;
const unmatched: string[] = [];
const skipped: string[] = [];

for (const h of hotels) {
  if (h.regionId && !FORCE) { skipped.push(h.name); continue; }
  const addr = norm(h.address ?? '');
  if (!addr) { unmatched.push(`${h.name} (adres yok)`); continue; }

  // En erken geçen anahtar kazanır
  let best: { region: typeof keyed[number]; idx: number } | null = null;
  for (const r of keyed) {
    for (const k of r.keys) {
      const idx = addr.indexOf(k);
      if (idx !== -1 && (best === null || idx < best.idx)) best = { region: r, idx };
    }
  }

  if (!best) { unmatched.push(`${h.name} — ${h.address}`); continue; }

  console.log(`  ✓ ${h.name} → ${best.region.name}`);
  if (!DRY) await prisma.location.update({ where: { id: h.id }, data: { regionId: best.region.id } });
  linked++;
}

if (!DRY) await invalidateLocationsCache();

console.log(`\n${DRY ? '[DRY RUN] ' : ''}✅ ${linked} otel bölgeye bağlandı`);
if (skipped.length)   console.log(`   ${skipped.length} otel zaten bağlıydı (atlandı): ${skipped.join(', ')}`);
if (unmatched.length) console.log(`   ⚠️  ${unmatched.length} otel eşleşmedi (admin panelinden elle seçin):\n     - ${unmatched.join('\n     - ')}`);

process.exit(0);
