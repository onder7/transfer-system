import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export type UserRole = 'ADMIN' | 'OPERATOR' | 'CUSTOMER' | 'DRIVER';

interface AuthUser {
  id:        string;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      UserRole;
}

interface AuthState {
  user:    AuthUser | null;
  isReady: boolean;
  login:   (email: string, password: string) => Promise<void>;
  register:(data: RegisterData) => Promise<void>;
  logout:  () => Promise<void>;
  setReady:() => void;
}

interface RegisterData {
  email: string; password: string;
  firstName: string; lastName: string;
  consent: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:    null,
      isReady: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user });
      },

      register: async (data) => {
        const res = await api.post('/auth/register', data);
        set({ user: res.data.user });
      },

      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        set({ user: null });
      },

      setReady: () => set({ isReady: true }),
    }),
    {
      name:    'auth',
      partialize: (s) => ({ user: s.user }),
    },
  ),
);
