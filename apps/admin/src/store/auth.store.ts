import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export type UserRole = 'ADMIN' | 'OPERATOR';

interface AuthUser {
  id:        string;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      UserRole;
}

interface AuthState {
  user:    AuthUser | null;
  login:   (email: string, password: string) => Promise<void>;
  logout:  () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        if (!['ADMIN', 'OPERATOR'].includes(data.user?.role)) {
          throw new Error('Bu panele erişim yetkiniz yok');
        }
        set({ user: data.user });
      },

      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        set({ user: null });
      },
    }),
    { name: 'admin-auth', partialize: (s) => ({ user: s.user }) },
  ),
);
