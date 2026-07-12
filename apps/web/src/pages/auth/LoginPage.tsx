import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';

export function LoginPage() {
  const { t }    = useTranslation();
  const { login } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = (location.state as any)?.from ?? '/';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">{t('nav.login')}</h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            {t('nav.register')}
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-8 card p-6 space-y-4">
          <div>
            <label className="label">{t('booking.guestEmail')}</label>
            <input type="email" className="input" value={email} autoComplete="email" required
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Şifre</label>
            <input type="password" className="input" value={password} autoComplete="current-password" required
              onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading ? t('common.loading') : t('nav.login')}
          </button>
        </form>
      </div>
    </div>
  );
}
