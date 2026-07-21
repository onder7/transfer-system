import { prisma } from '../config/database.js';

// Müşteri tarafına açık ekstra hizmetler (yalnızca aktif olanlar)
export async function listActiveExtras() {
  const rows = await prisma.extraService.findMany({
    where:   { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map((e) => ({
    id:           e.id,
    key:          e.key,
    name:         e.name,
    nameEn:       e.nameEn,
    description:  e.description,
    price:        Number(e.price),
    priceType:    e.priceType,
    requiresNote: e.requiresNote,
    maxQuantity:  e.maxQuantity,
  }));
}
