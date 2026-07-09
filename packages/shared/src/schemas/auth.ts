import { z } from 'zod';

export const RegisterSchema = z.object({
  firstName: z.string().min(2),
  lastName:  z.string().min(2),
  email:     z.string().email(),
  phone:     z.string().min(10).optional(),
  password:  z.string().min(8),
  consent:   z.literal(true, { message: 'KVKK onayı zorunludur' }),
});

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput    = z.infer<typeof LoginSchema>;
