import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="text-2xl">✈</span>
            <span className="text-lg font-bold text-gray-900">Dalaman Transfer</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-6 sm:flex">
            <Link to="/" className="text-sm font-medium text-gray-600 hover:text-brand-600 no-underline">
              {t('nav.home')}
            </Link>
            {user ? (
              <>
                <Link to="/my-bookings" className="text-sm font-medium text-gray-600 hover:text-brand-600 no-underline">
                  {t('nav.myBookings')}
                </Link>
                <button onClick={handleLogout} className="text-sm font-medium text-gray-600 hover:text-brand-600">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-brand-600 no-underline">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="btn-primary text-sm no-underline">
                  {t('nav.register')}
                </Link>
              </>
            )}
            {/* Dil */}
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr')}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              {i18n.language === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR'}
            </button>
          </div>

          {/* Mobile burger */}
          <button
            className="sm:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menü"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-3">
            <Link to="/" onClick={() => setMenuOpen(false)} className="text-sm text-gray-700 no-underline">{t('nav.home')}</Link>
            {user ? (
              <>
                <Link to="/my-bookings" onClick={() => setMenuOpen(false)} className="text-sm text-gray-700 no-underline">{t('nav.myBookings')}</Link>
                <button onClick={handleLogout} className="text-left text-sm text-gray-700">{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="text-sm text-gray-700 no-underline">{t('nav.login')}</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="text-sm text-gray-700 no-underline">{t('nav.register')}</Link>
              </>
            )}
            <button
              onClick={() => { i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr'); setMenuOpen(false); }}
              className="text-left text-sm text-gray-500"
            >
              {i18n.language === 'tr' ? '🇬🇧 English' : '🇹🇷 Türkçe'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
