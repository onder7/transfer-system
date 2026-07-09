import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface VehicleClass {
  id: string; name: string; nameEn: string | null;
  capacity: number; luggageCapacity: number; isShared: boolean;
  features: string[];
}

interface TransferResult {
  vehicleClass:     VehicleClass;
  price:            number;
  pricePerPerson:   number | null;
  returnPrice:      number | null;
  surchargeApplied: boolean;
  multiplier:       number;
}

const FEATURE_ICONS: Record<string, string> = {
  water: '💧', wifi: '📶', child_seat: '🪑', luggage: '🧳',
};

export function SearchPage() {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const isEn      = i18n.language === 'en';

  const from   = params.get('fromLocationId') ?? '';
  const to     = params.get('toLocationId')   ?? '';
  const date   = params.get('transferDate')   ?? '';
  const adults = params.get('adultCount')     ?? '1';
  const kids   = params.get('childCount')     ?? '0';
  const ret    = params.get('returnFlight')   ?? 'false';
  const flight = params.get('flightNumber')   ?? undefined;

  const totalPax = Number(adults) + Number(kids);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transfers', from, to, date, adults, kids, ret],
    queryFn:  () =>
      api.get<{ results: TransferResult[] }>('/transfers/search', {
        params: { fromLocationId: from, toLocationId: to, transferDate: date,
                  adultCount: adults, childCount: kids, returnFlight: ret,
                  ...(flight ? { flightNumber: flight } : {}) },
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
        <button onClick={() => window.location.reload()} className="btn btn-outline mt-3">
          {t('common.retry')}
        </button>
      </div>
    </div>
  );

  const results = data?.results ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('search.title')}</h1>
        <span className="text-sm text-gray-500">
          {totalPax} yolcu
          {Number(kids) > 0 ? ` (${adults} yetişkin + ${kids} çocuk)` : ''}
        </span>
      </div>

      {results.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl">🚗</p>
          <p className="mt-3 text-gray-500">{t('search.noResult')}</p>
          <button onClick={() => navigate(-1)} className="btn btn-outline mt-4">
            Geri Dön
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((r) => (
            <div key={r.vehicleClass.id} className="card overflow-hidden">
              {r.vehicleClass.isShared && (
                <div className="bg-amber-50 px-5 py-2 text-xs font-medium text-amber-700">
                  🚌 Paylaşımlı Transfer — kişi başı fiyatlandırma
                </div>
              )}
              <div className="flex items-start gap-4 p-5">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {isEn && r.vehicleClass.nameEn ? r.vehicleClass.nameEn : r.vehicleClass.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Max {r.vehicleClass.capacity} yolcu · {r.vehicleClass.luggageCapacity} bagaj
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.vehicleClass.features.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
                      >
                        {FEATURE_ICONS[f] ?? ''} {t(`search.features.${f}`, { defaultValue: f })}
                      </span>
                    ))}
                  </div>
                  {r.surchargeApplied && (
                    <p className="mt-1.5 text-xs text-amber-600">⚠ Gece/sezon zammı uygulandı</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    {r.price.toLocaleString('tr-TR')} ₺
                  </p>
                  {r.vehicleClass.isShared && r.pricePerPerson !== null ? (
                    <p className="text-xs text-gray-400">
                      {r.pricePerPerson.toLocaleString('tr-TR')} ₺ × {totalPax} kişi
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">araç başı</p>
                  )}
                  {r.returnPrice !== null && (
                    <p className="mt-0.5 text-sm text-gray-500">
                      + {r.returnPrice.toLocaleString('tr-TR')} ₺ dönüş
                    </p>
                  )}
                  <button
                    onClick={() => handleSelect(r.vehicleClass.id)}
                    className="btn btn-primary mt-3"
                  >
                    Seç
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
