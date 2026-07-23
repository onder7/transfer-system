import { Request, Response, NextFunction } from 'express';
import {
  listVehicles,
  availableVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from '../services/vehicle.service.js';
import { CreateVehicleSchema, UpdateVehicleSchema } from '@transfer/shared';

export async function listVehiclesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { vehicleClassId, driverId, onlyActive } = req.query as Record<string, string>;
    const vehicles = await listVehicles({
      vehicleClassId: vehicleClassId || undefined,
      driverId:       driverId       || undefined,
      onlyActive:     onlyActive === 'true',
    });
    res.json({ vehicles });
  } catch (err) { next(err); }
}

export async function availableVehiclesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { vehicleClassId, transferDate, estimatedDurationMin } = req.query as Record<string, string>;
    if (!vehicleClassId || !transferDate) {
      res.status(400).json({ message: 'vehicleClassId ve transferDate gerekli' });
      return;
    }
    const estMin = estimatedDurationMin ? Number(estimatedDurationMin) : undefined;
    const vehicles = await availableVehicles(vehicleClassId, new Date(transferDate), estMin);
    res.json({ vehicles });
  } catch (err) { next(err); }
}

export async function createVehicleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = CreateVehicleSchema.parse(req.body);
    const vehicle = await createVehicle(input);
    res.status(201).json({ vehicle });
  } catch (err) { next(err); }
}

export async function updateVehicleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = UpdateVehicleSchema.parse(req.body);
    const vehicle = await updateVehicle(req.params.id as string, input);
    res.json({ vehicle });
  } catch (err) { next(err); }
}

export async function deleteVehicleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteVehicle(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
}
