import { z } from 'zod';

export const UpdateAssignmentStatusSchema = z.object({
  status: z.enum(['EN_ROUTE', 'PICKED_UP', 'COMPLETED']),
});

export const AssignDriverSchema = z.object({
  driverId:       z.string().min(1),
  vehicleClassId: z.string().min(1),
  vehicleId:      z.string().optional(), // Vehicle tablosundan — plaka otomatik dolar
  vehiclePlate:   z.string().optional(), // vehicleId yoksa manuel giriş (fallback)
});

export const CreateVehicleSchema = z.object({
  plate:           z.string().min(1).max(20).transform((v) => v.toUpperCase().trim()),
  vehicleClassId:  z.string().min(1),
  defaultDriverId: z.string().optional(),
  notes:           z.string().optional(),
});

export const UpdateVehicleSchema = CreateVehicleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateAssignmentStatusInput = z.infer<typeof UpdateAssignmentStatusSchema>;
export type AssignDriverInput           = z.infer<typeof AssignDriverSchema>;
export type CreateVehicleInput          = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicleInput          = z.infer<typeof UpdateVehicleSchema>;
