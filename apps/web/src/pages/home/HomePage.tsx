import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Location {
  id: string; name: string; nameEn: string; type: string;
}

const FEATURES = [
  { key: 'safe',    icon: '🛡️' },
  { key: 'ontime',  icon: '⏱️' },
  { key: 'comfort', icon: '💺' },
  { key: 'support', icon: '📞' },
] as const;

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn = i18n.language === 'en';

  const [form, setForm] = useState({
    fromLocationId: '',
    toLocationId:   '',
    transferDate:   '',
    passengerCount: '2',
    returnFlight:   false,
    flightNumber:   '',
  });

  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => api.get<{ locations: Location[] }>('/locations').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const locations = locData?.locations ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fromLocationId || !form.toLocationId || !form.transferDate) return;
    const params = new URLSearchParams({
      fromLocationId: form.fromLocationId,
      toLocationId:   form.toLocationId,
      transferDate:   form.transferDate,
      passengerCount: form.passengerCount,
      returnFlight:   String(form.returnFlight),
      ...(form.flightNumber ? { flightNumber: form.flightNumber } : {}),
    });
    navigate(`/search?${params}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 to-brand-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t('home.hero.title')}
            </h1>
            <p className="mt-4 text-lg text-brand-200">{t('home.hero.subtitle')}</p>
          </div>

          {/* Arama formu */}
          <form
            onSubmit={handleSearch}
            className="mx-auto mt-10 max-w-3xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label text-gray-700">{t('home.search.from')}</label>
                <select
                  className="input"
                  value={form.fromLocationId}
                  onChange={(e) => setForm((f) => ({ ...f, fromLocationId: e.target.value }))}
                  required
                >
                  <option value="">Seçiniz…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{isEn ? l.nameEn : l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-gray-700">{t('home.search.to')}</label>
                <select
                  className="input"
                  value={form.toLocationId}
                  onChange={(e) => setForm((f) => ({ ...f, toLocationId: e.target.value }))}
                  required
                >
                  <option value="">Seçiniz…</option>
                  {locations
                    .filter((l) => l.id !== form.fromLocationId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>{isEn ? l.nameEn : l.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="label text-gray-700">{t('home.search.date')}</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.transferDate}
                  onChange={(e) => setForm((f) => ({ ...f, transferDate: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>

              <div>
                <label className="label text-gray-700">{t('home.search.passengers')}</label>
                <select
                  className="input"
                  value={form.passengerCount}
                  onChange={(e) => setForm((f) => ({ ...f, passengerCount: e.target.value }))}
                >
                  {[1,2,3,4,5,6,7,8].map((n) => (
                    <option key={n} value={n}>{n} {t('common.passengers')}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label text-gray-700">{t('home.search.flight')}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="TK1234"
                  value={form.flightNumber}
                  onChange={(e) => setForm((f) => ({ ...f, flightNumber: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                id="returnFlight"
                type="checkbox"
                className="size-4 rounded border-gray-300 text-brand-600"
                checked={form.returnFlight}
                onChange={(e) => setForm((f) => ({ ...f, returnFlight: e.target.checked }))}
              />
              <label htmlFor="returnFlight" className="text-sm text-gray-600">
                {t('home.search.returnTrip')}
              </label>
            </div>

            <button type="submit" className="btn-primary btn-lg mt-6 w-full">
              {t('home.search.search')}
            </button>
          </form>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ key, icon }) => (
              <div key={key} className="card p-6 text-center">
                <div className="text-4xl">{icon}</div>
                <h3 className="mt-3 font-semibold text-gray-900">
                  {t(`home.features.${key}.title`)}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t(`home.features.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
