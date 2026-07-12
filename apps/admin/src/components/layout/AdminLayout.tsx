import { Outlet, Navigate } from 'react-router-dom';
import { useQuery }          from '@tanstack/react-query';
import { Sidebar }           from './Sidebar';
import { AdminHeader }       from './AdminHeader';
import { useAuthStore }      from '@/store/auth.store';
import { api }               from '@/lib/api';

interface Setting { key: string; value: string }

export function AdminLayout() {
  const { user } = useAuthStore();

  // Hook'lar koşullu return'den ÖNCE çağrılmalı
  const { data } = useQuery({
    queryKey: ['admin', 'system-settings'],
    queryFn:  () => api.get<{ settings: Setting[] }>('/admin/system-settings').then((r) => r.data),
    staleTime: 60_000,
    enabled: !!user, // kullanıcı yoksa sorgu çalıştırma
  });

  if (!user) return <Navigate to="/login" replace />;

  const timezone = data?.settings.find((s) => s.key === 'timezone')?.value ?? 'Europe/Istanbul';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader timezone={timezone} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
