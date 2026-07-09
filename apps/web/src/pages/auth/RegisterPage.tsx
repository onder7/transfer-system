import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';

export function RegisterPage() {
  const { t }      = useTranslation();
  const { register } = useAuthStore();
  const navigate     = useNavigate();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', consent: false,
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent) { setError(t('booking.kvkkAgreement') + ' gereklidir'); return; }
    setLoading(true);
    setError('');
    try {
      await register(form);
      navigate('/');
    } catch (err: any) {
      const details = err.response?.data?.details;
      if (details) {
        const msgs = Object.values(details).flat() as string[];
        setError(msgs[0] ?? t('errors.networkError'));
      } else {
        setError(err.response?.data?.error ?? t('errors.networkError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">{t('nav.register')}</h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="font-medium text-brand-600">{t('nav.login')}</Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-8 card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ad</label>
              <input className="input" value={form.firstName} required
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Soyad</label>
              <input className="input" value={form.lastName} required
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">{t('booking.guestEmail')}</label>
            <input type="email" className="input" value={form.email} autoComplete="email" required
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Şifre (min. 8 karakter)</label>
            <input type="password" className="input" value={form.password} autoComplete="new-password"
              minLength={8} required
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-gray-300"
              checked={form.consent}
              onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))} />
            <span>{t('booking.kvkkAgreement')}</span>
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !form.consent} className="btn btn-primary btn-lg w-full">
            {loading ? t('common.loading') : t('nav.register')}
          </button>
        </form>
      </div>
    </div>
  );
}
