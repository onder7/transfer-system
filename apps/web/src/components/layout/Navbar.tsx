import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { Plane, Menu, X } from 'lucide-react';

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group no-underline">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform shrink-0">
            <Plane size={16} className="text-white -rotate-45 sm:w-[18px] sm:h-[18px]" />
          </div>
          <span
            className={`font-bold text-base sm:text-xl tracking-tight transition-colors duration-300 ${
              scrolled ? 'text-slate-900' : 'text-white'
            }`}
          >
            Sipahi<span className="text-emerald-500">VIP</span> Transfer
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors no-underline ${
              scrolled ? 'text-slate-600 hover:text-emerald-600' : 'text-white/80 hover:text-white'
            }`}
          >
            {t('nav.home')}
          </Link>

          {user ? (
            <>
              <Link
                to="/my-bookings"
                className={`text-sm font-medium transition-colors no-underline ${
                  scrolled ? 'text-slate-600 hover:text-emerald-600' : 'text-white/80 hover:text-white'
                }`}
              >
                {t('nav.myBookings')}
              </Link>
              <button
                onClick={handleLogout}
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-slate-600 hover:text-emerald-600' : 'text-white/80 hover:text-white'
                }`}
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/booking-lookup"
                className={`text-sm font-medium transition-colors no-underline ${
                  scrolled ? 'text-slate-600 hover:text-emerald-600' : 'text-white/80 hover:text-white'
                }`}
              >
                Rezervasyon Sorgula
              </Link>
              <Link
                to="/login"
                className={`text-sm font-medium transition-colors no-underline ${
                  scrolled ? 'text-slate-600 hover:text-emerald-600' : 'text-white/80 hover:text-white'
                }`}
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-600 transition-all hover:-translate-y-0.5 no-underline"
              >
                {t('nav.register')}
              </Link>
            </>
          )}

          {/* Dil değiştirici */}
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr')}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
              scrolled ? 'text-slate-500 hover:text-slate-700' : 'text-white/70 hover:text-white'
            }`}
          >
            {i18n.language === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR'}
          </button>
        </div>

        {/* Mobile burger */}
        <button
          className={`md:hidden rounded-xl p-2 transition-colors ${
            scrolled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'
          }`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menü"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-md px-6 py-4 animate-slideUp">
          <div className="flex flex-col gap-4">
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-white/80 hover:text-white no-underline"
            >
              {t('nav.home')}
            </Link>
            {user ? (
              <>
                <Link
                  to="/my-bookings"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-white/80 hover:text-white no-underline"
                >
                  {t('nav.myBookings')}
                </Link>
                <button onClick={handleLogout} className="text-left text-sm font-medium text-white/80 hover:text-white">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/booking-lookup"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-white/80 hover:text-white no-underline"
                >
                  Rezervasyon Sorgula
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-white/80 hover:text-white no-underline"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white no-underline"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}
            <button
              onClick={() => { i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr'); setMenuOpen(false); }}
              className="text-left text-sm font-medium text-white/60 hover:text-white"
            >
              {i18n.language === 'tr' ? '🇬🇧 English' : '🇹🇷 Türkçe'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
