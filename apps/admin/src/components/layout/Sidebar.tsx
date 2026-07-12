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
  { to: '/locations',    icon: '📍', label: 'Lokasyonlar',    adminOnly: true },
  { to: '/drivers',      icon: '👨‍✈️', label: 'Şoförler' },
  { to: '/vehicles',     icon: '🚗', label: 'Araçlar' },
  { to: '/pricing',      icon: '💰', label: 'Fiyatlandırma' },
  { to: '/coupons',      icon: '🎟️', label: 'Kuponlar' },
  { to: '/users',        icon: '👥', label: 'Kullanıcılar',   adminOnly: true },
  { to: '/integrations', icon: '🔌', label: 'Entegrasyonlar', adminOnly: true },
  { to: '/settings',     icon: '⚙️', label: 'Sistem Ayarları', adminOnly: true },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside
      className="flex w-64 shrink-0 flex-col"
      style={{ backgroundColor: '#1e2a3b' }}
    >
      {/* Logo */}
      <div
        className="flex h-16 items-center gap-3 px-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="text-2xl">✈️</span>
        <span className="text-lg font-bold tracking-tight text-white">Transfer Yönetim</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="sidebar-link"
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Kullanıcı */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: '#2563eb' }}
          >
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {user?.role}
            </p>
          </div>
          <button
            onClick={() => logout()}
            title="Çıkış yap"
            className="sidebar-link rounded p-1 text-base"
            style={{ gap: 0 }}
          >
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}
