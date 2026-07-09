import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TransferResult {
  vehicleClass: { id: string; name: string; nameEn: string; capacity: number; features: string[] };
  price:        number;
  returnPrice:  number | null;
  surchargeApplied: boolean;
  multiplier:   number;
}

const FEATURE_ICONS: Record<string, string> = {
  water: '💧', wifi: '📶', child_seat: '🪑', luggage: '🧳',
};

export function SearchPage() {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const isEn      = i18n.language === 'en';

  const from    = params.get('fromLocationId') ?? '';
  const to      = params.get('toLocationId')   ?? '';
  const date    = params.get('transferDate')    ?? '';
  const pax     = params.get('passengerCount')  ?? '2';
  const ret     = params.get('returnFlight')    ?? 'false';
  const flight  = params.get('flightNumber')    ?? undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transfers', from, to, date, pax, ret],
    queryFn:  () =>
      api.get<{ results: TransferResult[] }>('/transfers/search', {
        params: { fromLocationId: from, toLocationId: to, transferDate: date,
                  passengerCount: pax, returnFlight: ret, flightNumber: flight },
      }).then((r) => r.data),
    enabled: !!(from && to && date),
  });

  const handleSelect = (vcId: string) => {
    const sp = new URLSearchParams(params);
    sp.set('vehicleClassId', vcId);
    navigate(`/booking?${sp}`);
  };

  if (isLoading) return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-gray-500">{t('common.loading')}</div>
    </div>
  );

  if (isError) return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500">{t('common.error')}</p>
        <button onClick={() => window.location.reload()} className="btn-outline mt-3">
          {t('common.retry')}
        </button>
      </div>
    </div>
  );

  const results = data?.results ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('search.title')}</h1>

      {results.length === 0 ? (
        <p className="mt-6 text-gray-500">{t('search.noResult')}</p>
      ) : (
        <div className="mt-6 space-y-4">
          {results.map((r) => (
            <div key={r.vehicleClass.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {isEn ? r.vehicleClass.nameEn : r.vehicleClass.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t('search.capacity', { count: r.vehicleClass.capacity })}
                  </p>
                  {/* Özellikler */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.vehicleClass.features.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                        {FEATURE_ICONS[f] ?? ''} {t(`search.features.${f}`, { defaultValue: f })}
                      </span>
                    ))}
                  </div>
                  {r.surchargeApplied && (
                    <p className="mt-1 text-xs text-amber-600">⚠ {t('search.surcharge')}</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-brand-600">
                    {r.price.toLocaleString('tr-TR')} ₺
                  </p>
                  {r.returnPrice && (
                    <p className="text-sm text-gray-500">
                      + {r.returnPrice.toLocaleString('tr-TR')} ₺ dönüş
                    </p>
                  )}
                  <button
                    onClick={() => handleSelect(r.vehicleClass.id)}
                    className="btn-primary mt-3"
                  >
                    {t('search.selectVehicle')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
