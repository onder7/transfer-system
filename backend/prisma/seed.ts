import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

async function main() {
  // Admin kullanıcısı
  const adminHash = await hashPassword('admin123!');
  await prisma.user.upsert({
    where:  { email: 'admin@transfer.local' },
    update: { passwordHash: adminHash },
    create: {
      email:        'admin@transfer.local',
      firstName:    'Admin',
      lastName:     'User',
      role:         'ADMIN',
      passwordHash: adminHash,
      consentGiven: true,
      consentAt:    new Date(),
    },
  });

  // Lokasyonlar
  const dalaman = await prisma.location.upsert({
    where:  { id: 'loc_dalaman_airport' },
    update: {},
    create: { id: 'loc_dalaman_airport', name: 'Dalaman Havalimanı', nameEn: 'Dalaman Airport', type: 'airport', lat: 36.7131, lng: 28.7925 },
  });

  const fethiye = await prisma.location.upsert({
    where:  { id: 'loc_fethiye' },
    update: {},
    create: { id: 'loc_fethiye', name: 'Fethiye Merkez', nameEn: 'Fethiye Center', type: 'region', lat: 36.6552, lng: 29.1224 },
  });

  const marmaris = await prisma.location.upsert({
    where:  { id: 'loc_marmaris' },
    update: {},
    create: { id: 'loc_marmaris', name: 'Marmaris Merkez', nameEn: 'Marmaris Center', type: 'region', lat: 36.8557, lng: 28.2700 },
  });

  const olüdeniz = await prisma.location.upsert({
    where:  { id: 'loc_oludeniz' },
    update: {},
    create: { id: 'loc_oludeniz', name: 'Ölüdeniz', nameEn: 'Oludeniz', type: 'region', lat: 36.5467, lng: 29.1126 },
  });

  // Araç sınıfları
  const sedan = await prisma.vehicleClass.upsert({
    where:  { id: 'vc_sedan' },
    update: {},
    create: { id: 'vc_sedan', name: 'Sedan', nameEn: 'Sedan', capacity: 4, features: ['water', 'wifi'] },
  });

  const vito = await prisma.vehicleClass.upsert({
    where:  { id: 'vc_vito' },
    update: {},
    create: { id: 'vc_vito', name: 'VIP Vito', nameEn: 'VIP Vito', capacity: 8, features: ['water', 'wifi', 'child_seat', 'luggage'] },
  });

  const minibus = await prisma.vehicleClass.upsert({
    where:  { id: 'vc_minibus' },
    update: {},
    create: { id: 'vc_minibus', name: 'Minibüs', nameEn: 'Minibus', capacity: 16, features: ['water', 'luggage'] },
  });

  // Fiyat matrisi (örnek — TRY bazında)
  const prices = [
    { from: dalaman.id, to: fethiye.id,  vc: sedan.id,   price: 850 },
    { from: dalaman.id, to: fethiye.id,  vc: vito.id,    price: 1200 },
    { from: dalaman.id, to: fethiye.id,  vc: minibus.id, price: 1600 },
    { from: dalaman.id, to: marmaris.id, vc: sedan.id,   price: 1100 },
    { from: dalaman.id, to: marmaris.id, vc: vito.id,    price: 1600 },
    { from: dalaman.id, to: marmaris.id, vc: minibus.id, price: 2200 },
    { from: dalaman.id, to: olüdeniz.id, vc: sedan.id,   price: 700 },
    { from: dalaman.id, to: olüdeniz.id, vc: vito.id,    price: 950 },
    { from: dalaman.id, to: olüdeniz.id, vc: minibus.id, price: 1300 },
  ];

  for (const p of prices) {
    await prisma.priceMatrix.upsert({
      where: { fromLocationId_toLocationId_vehicleClassId: { fromLocationId: p.from, toLocationId: p.to, vehicleClassId: p.vc } },
      update: { basePrice: p.price },
      create: { fromLocationId: p.from, toLocationId: p.to, vehicleClassId: p.vc, basePrice: p.price, returnDiscount: 10 },
    });
    // Ters yön de ekle
    await prisma.priceMatrix.upsert({
      where: { fromLocationId_toLocationId_vehicleClassId: { fromLocationId: p.to, toLocationId: p.from, vehicleClassId: p.vc } },
      update: { basePrice: p.price },
      create: { fromLocationId: p.to, toLocationId: p.from, vehicleClassId: p.vc, basePrice: p.price, returnDiscount: 10 },
    });
  }

  // Gece zammı surcharge
  await prisma.priceSurcharge.upsert({
    where:  { id: 'surge_night' },
    update: {},
    create: { id: 'surge_night', name: 'Gece Zammı', multiplier: 1.20, startHour: 22, endHour: 6 },
  });

  // Şoför kullanıcısı
  const soforHash = await hashPassword('sofor123!');
  await prisma.user.upsert({
    where:  { email: 'sofor@transfer.local' },
    update: { passwordHash: soforHash },
    create: {
      email:        'sofor@transfer.local',
      firstName:    'Mehmet',
      lastName:     'Şoför',
      phone:        '05351234567',
      role:         'DRIVER',
      passwordHash: soforHash,
      consentGiven: true,
      consentAt:    new Date(),
    },
  });

  // Test kuponu
  await prisma.coupon.upsert({
    where:  { code: 'HOSGELDIN10' },
    update: {},
    create: {
      code:         'HOSGELDIN10',
      discountType: 'percent',
      amount:       10,
      maxUses:      100,
      isActive:     true,
    },
  });

  // Ekstra hizmetler (admin panelinden fiyatları yönetilir)
  await prisma.extraService.upsert({
    where:  { key: 'child_seat' },
    update: {},
    create: {
      key:         'child_seat',
      name:        'Çocuk Koltuğu',
      nameEn:      'Child Seat',
      description: 'Bebek / çocuk güvenlik koltuğu (adet başı)',
      price:       150,
      priceType:   'PER_UNIT',
      maxQuantity: 4,
      sortOrder:   1,
      isActive:    true,
    },
  });
  await prisma.extraService.upsert({
    where:  { key: 'name_greeting' },
    update: {},
    create: {
      key:          'name_greeting',
      name:         'İsimle Karşılama',
      nameEn:       'Name Sign Meet & Greet',
      description:  'Şoförün isminizin yazılı olduğu pano ile karşılaması',
      price:        200,
      priceType:    'FLAT',
      requiresNote: true,
      maxQuantity:  1,
      sortOrder:    2,
      isActive:     true,
    },
  });

  console.log('✅ Seed tamamlandı');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
