import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Location {
  id: string; name: string; nameEn: string | null; type: string;
}

type Direction = 'AIRPORT_TO_REGION' | 'REGION_TO_AIRPORT';

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const FEATURES = [
  { key: 'safe',    icon: '🛡️' },
  { key: 'ontime',  icon: '⏱️' },
  { key: 'comfort', icon: '💺' },
  { key: 'support', icon: '📞' },
] as const;

function SpinnerInput({
  label, value, min, max,
  onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex size-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100"
        >−</button>
        <span className="w-8 text-center text-base font-semibold text-gray-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex size-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100"
        >+</button>
      </div>
    </div>
  );
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn     = i18n.language === 'en';

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const initHour = String(today.getHours()).padStart(2, '0');

  const [direction, setDirection] = useState<Direction>('AIRPORT_TO_REGION');
  const [regionId,  setRegionId]  = useState('');
  const [date,      setDate]      = useState(todayStr);
  const [hour,      setHour]      = useState(initHour);
  const [minute,    setMinute]    = useState('00');
  const [adultCount,  setAdults]  = useState(2);
  const [childCount,  setChildren] = useState(0);
  const [flightNo,  setFlightNo]  = useState('');
  const [returnFlight, setReturn] = useState(false);

  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => api.get<{ locations: Location[] }>('/locations').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const locations = locData?.locations ?? [];
  const airports  = useMemo(() => locations.filter((l) => l.type === 'airport'), [locations]);
  const regions   = useMemo(() => locations.filter((l) => l.type !== 'airport'), [locations]);

  // Dalaman havalimanı — ilk airport kaydı
  const airport = airports[0];

  const fromLocationId = direction === 'AIRPORT_TO_REGION' ? (airport?.id ?? '') : regionId;
  const toLocationId   = direction === 'AIRPORT_TO_REGION' ? regionId : (airport?.id ?? '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromLocationId || !toLocationId) return;
    const transferDate = `${date}T${hour}:${minute}:00.000Z`;
    const params = new URLSearchParams({
      fromLocationId,
      toLocationId,
      transferDate,
      adultCount:  String(adultCount),
      childCount:  String(childCount),
      returnFlight: String(returnFlight),
      ...(flightNo ? { flightNumber: flightNo } : {}),
    });
    navigate(`/search?${params}`);
  };

  const locName = (l: Location) => (isEn && l.nameEn ? l.nameEn : l.name);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 to-blue-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t('home.hero.title')}
            </h1>
            <p className="mt-4 text-lg text-blue-200">{t('home.hero.subtitle')}</p>
          </div>

          {/* Arama formu */}
          <form
            onSubmit={handleSearch}
            className="mx-auto mt-10 max-w-3xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            {/* Transfer yönü */}
            <div className="mb-5">
              <label className="label text-gray-700">Transfer Yönü</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['AIRPORT_TO_REGION', 'REGION_TO_AIRPORT'] as Direction[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDirection(d); setRegionId(''); }}
                    className={[
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 px-3 text-sm font-medium transition-colors',
                      direction === d
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                    ].join(' ')}
                  >
                    {d === 'AIRPORT_TO_REGION' ? '✈️ Havalimanı → Bölge' : '🏠 Bölge → Havalimanı'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Alış yeri */}
              <div>
                <label className="label text-gray-700">
                  {direction === 'AIRPORT_TO_REGION' ? 'Alış Yeri (Havalimanı)' : 'Alış Yeri (Bölge)'}
                </label>
                {direction === 'AIRPORT_TO_REGION' ? (
                  <input
                    className="input bg-gray-50 text-gray-600"
                    value={airport ? locName(airport) : 'Yükleniyor…'}
                    readOnly
                  />
                ) : (
                  <select
                    className="input"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    required
                  >
                    <option value="">Bölge seçiniz…</option>
                    {regions.map((l) => (
                      <option key={l.id} value={l.id}>{locName(l)}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Bırakma yeri */}
              <div>
                <label className="label text-gray-700">
                  {direction === 'AIRPORT_TO_REGION' ? 'Bırakma Yeri (Bölge)' : 'Bırakma Yeri (Havalimanı)'}
                </label>
                {direction === 'REGION_TO_AIRPORT' ? (
                  <input
                    className="input bg-gray-50 text-gray-600"
                    value={airport ? locName(airport) : 'Yükleniyor…'}
                    readOnly
                  />
                ) : (
                  <select
                    className="input"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    required
                  >
                    <option value="">Bölge seçiniz…</option>
                    {regions.map((l) => (
                      <option key={l.id} value={l.id}>{locName(l)}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tarih */}
              <div>
                <label className="label text-gray-700">Transfer Tarihi</label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={todayStr}
                  required
                />
              </div>

              {/* Saat */}
              <div>
                <label className="label text-gray-700">Saat</label>
                <div className="flex gap-2">
                  <select
                    className="input"
                    value={hour}
                    onChange={(e) => setHour(e.target.value)}
                  >
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select
                    className="input"
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                  >
                    {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Yolcu sayıları */}
              <div className="flex gap-8 sm:col-span-2">
                <SpinnerInput
                  label="Yetişkin"
                  value={adultCount}
                  min={1}
                  max={20}
                  onChange={setAdults}
                />
                <SpinnerInput
                  label="Çocuk (0–12 yaş)"
                  value={childCount}
                  min={0}
                  max={10}
                  onChange={setChildren}
                />
              </div>

              {/* Uçuş numarası */}
              <div className="sm:col-span-2">
                <label className="label text-gray-700">Uçuş Numarası <span className="font-normal text-gray-400">(opsiyonel)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="TK1234"
                  value={flightNo}
                  onChange={(e) => setFlightNo(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            {/* Gidiş–dönüş */}
            <div className="mt-4 flex items-center gap-2">
              <input
                id="returnFlight"
                type="checkbox"
                className="size-4 rounded border-gray-300"
                checked={returnFlight}
                onChange={(e) => setReturn(e.target.checked)}
              />
              <label htmlFor="returnFlight" className="text-sm text-gray-600">
                Gidiş–dönüş transfer ekle
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary mt-6 w-full py-3 text-base"
            >
              Transfer Ara →
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
