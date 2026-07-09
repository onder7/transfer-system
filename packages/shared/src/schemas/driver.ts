import { z } from 'zod';

export const UpdateAssignmentStatusSchema = z.object({
  status: z.enum(['EN_ROUTE', 'COMPLETED']),
});

export const AssignDriverSchema = z.object({
  driverId:      z.string().min(1),
  vehicleClassId: z.string().min(1),
  vehiclePlate:  z.string().optional(),
});

export type UpdateAssignmentStatusInput = z.infer<typeof UpdateAssignmentStatusSchema>;
export type AssignDriverInput           = z.infer<typeof AssignDriverSchema>;
