import { Navigate, Outlet } from 'react-router-dom';
import { LogOut, Car } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

/**
 * Şoför PWA kabuğu — mobil öncelikli, tam ekran. Yalnızca DRIVER rolü erişebilir.
 * Müşteri sitesinin header/footer'ından bağımsız sade bir arayüz.
 */
export function DriverLayout() {
  const { user, logout } = useAuthStore();

  if (!user) return <Navigate to="/login" replace state={{ from: '/surucu' }} />;
  if (user.role !== 'DRIVER') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Car size={20} className="text-emerald-400" />
            <div className="leading-tight">
              <p className="text-sm font-bold">Şoför Paneli</p>
              <p className="text-[11px] text-white/60">{user.firstName} {user.lastName}</p>
            </div>
          </div>
          <button onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">
            <LogOut size={14} /> Çıkış
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
