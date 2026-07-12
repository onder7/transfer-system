import { prisma }   from '../config/database.js';
import { AppError } from '../middlewares/error.middleware.js';
import type { CreateVehicleInput, UpdateVehicleInput } from '@transfer/shared';

export async function listVehicles(filters?: { vehicleClassId?: string; driverId?: string; onlyActive?: boolean }) {
  return prisma.vehicle.findMany({
    where: {
      ...(filters?.vehicleClassId ? { vehicleClassId: filters.vehicleClassId } : {}),
      ...(filters?.driverId       ? { defaultDriverId: filters.driverId }       : {}),
      ...(filters?.onlyActive     ? { isActive: true }                          : {}),
    },
    include: {
      vehicleClass:  { select: { id: true, name: true } },
      defaultDriver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { plate: 'asc' },
  });
}

// Belirli bir transferDate için uygun araçları döndür (sınıf + aktif + çakışma yok)
export async function availableVehicles(vehicleClassId: string, transferDate: Date) {
  const turnaroundSetting = await prisma.systemSetting.findUnique({
    where: { key: 'vehicle_turnaround_minutes' },
  });
  const bufferMs = (turnaroundSetting ? Number(turnaroundSetting.value) : 120) * 60_000;
  const from = new Date(transferDate.getTime() - bufferMs);
  const to   = new Date(transferDate.getTime() + bufferMs);

  const busy = await prisma.driverAssignment.findMany({
    where: {
      status: { in: ['ASSIGNED', 'EN_ROUTE'] },
      vehicleId: { not: null },
      booking: {
        status:      { notIn: ['CANCELLED', 'COMPLETED'] },
        transferDate: { gte: from, lte: to },
      },
    },
    select: { vehicleId: true },
  });
  const busyIds = new Set(busy.map((a) => a.vehicleId).filter(Boolean) as string[]);

  return prisma.vehicle.findMany({
    where: {
      vehicleClassId,
      isActive: true,
      id: busyIds.size > 0 ? { notIn: [...busyIds] } : undefined,
    },
    include: {
      defaultDriver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { plate: 'asc' },
  });
}

export async function createVehicle(input: CreateVehicleInput) {
  const exists = await prisma.vehicle.findUnique({ where: { plate: input.plate } });
  if (exists) throw new AppError(409, `${input.plate} plakalı araç zaten kayıtlı`);

  return prisma.vehicle.create({
    data: {
      plate:           input.plate,
      vehicleClassId:  input.vehicleClassId,
      defaultDriverId: input.defaultDriverId ?? null,
      notes:           input.notes ?? null,
    },
    include: {
      vehicleClass:  { select: { id: true, name: true } },
      defaultDriver: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function updateVehicle(id: string, input: UpdateVehicleInput) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new AppError(404, 'Araç bulunamadı');

  if (input.plate && input.plate !== vehicle.plate) {
    const dup = await prisma.vehicle.findUnique({ where: { plate: input.plate } });
    if (dup) throw new AppError(409, `${input.plate} plakalı araç zaten kayıtlı`);
  }

  return prisma.vehicle.update({
    where: { id },
    data: {
      ...(input.plate           !== undefined ? { plate: input.plate }                     : {}),
      ...(input.vehicleClassId  !== undefined ? { vehicleClassId: input.vehicleClassId }   : {}),
      ...(input.defaultDriverId !== undefined ? { defaultDriverId: input.defaultDriverId } : {}),
      ...(input.notes           !== undefined ? { notes: input.notes }                     : {}),
      ...(input.isActive        !== undefined ? { isActive: input.isActive }               : {}),
    },
    include: {
      vehicleClass:  { select: { id: true, name: true } },
      defaultDriver: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function deleteVehicle(id: string) {
  const active = await prisma.driverAssignment.findFirst({
    where: { vehicleId: id, status: { in: ['ASSIGNED', 'EN_ROUTE'] } },
  });
  if (active) throw new AppError(400, 'Aktif atama olan araç silinemez. Önce pasife alın.');

  await prisma.vehicle.delete({ where: { id } });
  return { ok: true };
}
