import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

interface NavItem {
  to:    string;
  icon:  string;
  label: string;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard',    icon: '📊', label: 'Dashboard' },
  { to: '/bookings',     icon: '📋', label: 'Rezervasyonlar' },
  { to: '/drivers',      icon: '🚗', label: 'Şoförler' },
  { to: '/pricing',      icon: '💰', label: 'Fiyatlandırma' },
  { to: '/coupons',      icon: '🎟️', label: 'Kuponlar' },
  { to: '/users',        icon: '👥', label: 'Kullanıcılar',   adminOnly: true },
  { to: '/integrations', icon: '🔌', label: 'Entegrasyonlar', adminOnly: true },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="flex w-64 flex-col bg-[--color-sidebar-bg] text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <span className="text-2xl">✈️</span>
        <span className="font-bold text-lg tracking-tight">Transfer Yönetim</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors no-underline
               ${isActive
                 ? 'bg-[--color-sidebar-active] text-white'
                 : 'text-white/70 hover:bg-[--color-sidebar-hover] hover:text-white'}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Kullanıcı bilgisi */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.firstName} {user?.lastName}</p>
            <p className="truncate text-xs text-white/50">{user?.role}</p>
          </div>
          <button
            onClick={() => logout()}
            title="Çıkış"
            className="rounded p-1 text-white/50 hover:text-white"
          >
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}
