import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { HowItWorks } from '@/components/home/HowItWorks';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { Testimonials } from '@/components/home/Testimonials';
import {
  ArrowRight, RotateCcw, MapPin, Calendar, Clock,
  Users, Shield, Star, ChevronDown, Plane,
} from 'lucide-react';

interface Location {
  id: string; name: string; nameEn: string | null; type: string;
}

type Direction = 'AIRPORT_TO_REGION' | 'REGION_TO_AIRPORT';

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function SpinnerInput({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex size-8 items-center justify-center rounded-lg border-2 border-gray-200 bg-white text-gray-500 hover:border-emerald-400 hover:text-emerald-600 font-bold transition-colors"
        >−</button>
        <span className="w-8 text-center text-base font-bold text-slate-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex size-8 items-center justify-center rounded-lg border-2 border-gray-200 bg-white text-gray-500 hover:border-emerald-400 hover:text-emerald-600 font-bold transition-colors"
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
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const initHour = String(today.getHours()).padStart(2, '0');

  const [direction,    setDirection]  = useState<Direction>('AIRPORT_TO_REGION');
  const [airportId,    setAirportId]  = useState('');
  const [destType,     setDestType]   = useState<'region' | 'hotel'>('region');
  const [regionId,     setRegionId]   = useState('');
  const [date,         setDate]       = useState(todayStr);
  const [hour,         setHour]       = useState(initHour);
  const [minute,       setMinute]     = useState('00');
  const [dateError,    setDateError]  = useState('');
  const [adultCount,   setAdults]     = useState(2);
  const [childCount,   setChildren]   = useState(0);
  const [flightNo,     setFlightNo]   = useState('');
  const [returnFlight, setReturn]     = useState(false);

  const { data: settingsData } = useQuery({
    queryKey: ['public-settings'],
    queryFn:  () => api.get<{ settings: { key: string; value: string }[] }>('/settings').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const minAdvanceMin = parseInt(
    settingsData?.settings.find((s) => s.key === 'min_advance_minutes')?.value ?? '60',
    10,
  );

  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => api.get<{ locations: Location[] }>('/locations').then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn:  () => api.get<{ routes: { fromLocationId: string; toLocationId: string }[] }>('/locations/routes').then((r) => r.data),
    staleTime: 30_000,
  });

  const locations = locData?.locations ?? [];
  const routes    = routesData?.routes  ?? [];

  const allAirports = useMemo(() => locations.filter((l) => l.type === 'airport'), [locations]);
  const bolgeler    = useMemo(() => locations.filter((l) => l.type === 'region'),  [locations]);
  const oteller     = useMemo(() => locations.filter((l) => l.type === 'hotel'),   [locations]);

  const airports = useMemo(() => {
    if (!routes.length) return allAirports;
    const pricedIds = new Set(routes.flatMap((r) => [r.fromLocationId, r.toLocationId]));
    return allAirports.filter((a) => pricedIds.has(a.id));
  }, [routes, allAirports]);

  const resolvedAirportId = airportId || (airports.length === 1 ? airports[0].id : '');
  const airport = airports.find((a) => a.id === resolvedAirportId) ?? airports[0];

  const reachableFromAirport = useMemo(() => {
    if (!resolvedAirportId || !routes.length) return null;
    const ids = new Set<string>();
    routes.forEach((r) => {
      if (r.fromLocationId === resolvedAirportId) ids.add(r.toLocationId);
      if (r.toLocationId   === resolvedAirportId) ids.add(r.fromLocationId);
    });
    return ids;
  }, [routes, resolvedAirportId]);

  const reachableAirports = useMemo(() => {
    if (!regionId || !routes.length) return airports;
    const ids = new Set<string>();
    routes.forEach((r) => {
      if (r.fromLocationId === regionId) ids.add(r.toLocationId);
      if (r.toLocationId   === regionId) ids.add(r.fromLocationId);
    });
    return airports.filter((a) => ids.has(a.id));
  }, [routes, regionId, airports]);

  const rawDestList = destType === 'hotel' ? oteller : bolgeler;
  const destList    = reachableFromAirport
    ? rawDestList.filter((l) => reachableFromAirport.has(l.id))
    : rawDestList;

  useEffect(() => {
    if (regionId && reachableFromAirport && !reachableFromAirport.has(regionId)) {
      setRegionId('');
    }
  }, [reachableFromAirport, regionId]);

  const fromLocationId = direction === 'AIRPORT_TO_REGION' ? resolvedAirportId : regionId;
  const toLocationId   = direction === 'AIRPORT_TO_REGION' ? regionId : resolvedAirportId;

  const isToday  = date === todayStr;
  const earliest = new Date(Date.now() + minAdvanceMin * 60_000);
  const nowHour  = earliest.getHours();
  const nowMin   = earliest.getMinutes();

  const availableHours = useMemo(() => {
    if (!isToday) return HOURS;
    return HOURS.filter((h) => {
      const hNum = Number(h);
      if (hNum > nowHour) return true;
      if (hNum === nowHour) return MINUTES.some((m) => Number(m) > nowMin);
      return false;
    });
  }, [isToday, nowHour, nowMin]);

  const availableMinutes = useMemo(() => {
    if (!isToday || Number(hour) > nowHour) return MINUTES;
    return MINUTES.filter((m) => Number(m) > nowMin);
  }, [isToday, hour, nowHour, nowMin]);

  const prevAvailHours = useRef(availableHours);
  useEffect(() => {
    if (availableHours.length > 0 && !availableHours.includes(hour)) {
      setHour(availableHours[0]);
    }
    prevAvailHours.current = availableHours;
  }, [availableHours]);

  useEffect(() => {
    if (availableMinutes.length > 0 && !availableMinutes.includes(minute)) {
      setMinute(availableMinutes[0]);
    }
  }, [availableMinutes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');
    if (!resolvedAirportId || !fromLocationId || !toLocationId) return;
    const transferDate = new Date(`${date}T${hour}:${minute}:00`).toISOString();
    const earliestMs = Date.now() + minAdvanceMin * 60_000;
    if (new Date(transferDate).getTime() < earliestMs) {
      const h = Math.floor(minAdvanceMin / 60);
      const m = minAdvanceMin % 60;
      const label = h > 0 ? (m > 0 ? `${h} saat ${m} dakika` : `${h} saat`) : `${m} dakika`;
      setDateError(`Rezervasyon en az ${label} sonrası için yapılabilir.`);
      return;
    }
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
      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        {/* Arka plan görseli */}
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Lüks havalimanı transfer aracı"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/75 to-slate-800/65" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
        </div>

        {/* Noktalı doku */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        {/* Dekoratif blur topları */}
        <div className="pointer-events-none absolute -top-32 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-72 h-72 bg-sky-500/5 rounded-full blur-3xl" />

        {/* İçerik */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-32 pb-20 w-full">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* Sol: Metin alanı */}
            <div className="flex-1 text-center lg:text-left animate-fadeIn">
              {/* Rozet */}
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400 mb-6">
                <Plane size={12} className="-rotate-45" />
                {t('home.hero.badge')}
              </span>

              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-tight">
                {t('home.hero.title')}
              </h1>
              <p className="mt-5 text-lg text-slate-300 leading-relaxed max-w-xl">
                {t('home.hero.subtitle')}
              </p>

              {/* Trust badges */}
              <div className="mt-8 flex flex-wrap gap-4 justify-center lg:justify-start">
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Shield size={15} className="text-emerald-400 shrink-0" />
                  <span>Güvenli Ödeme</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Star size={15} className="text-amber-400 shrink-0 fill-amber-400" />
                  <span>4.9 Müşteri Puanı</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Users size={15} className="text-sky-400 shrink-0" />
                  <span>10.000+ Transfer</span>
                </div>
              </div>
            </div>

            {/* Sağ: Rezervasyon Formu */}
            <div className="w-full max-w-lg animate-slideUp">
              <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/30 overflow-hidden">

                {/* Yön sekmeleri */}
                <div className="flex border-b border-gray-100">
                  {(['AIRPORT_TO_REGION', 'REGION_TO_AIRPORT'] as Direction[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setDirection(d); setRegionId(''); setDestType('region'); }}
                      className={`flex-1 py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        direction === d
                          ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {d === 'AIRPORT_TO_REGION' ? (
                        <><Plane size={14} className="-rotate-45" /> Havalimanı → Bölge</>
                      ) : (
                        <><RotateCcw size={14} /> Bölge → Havalimanı</>
                      )}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSearch} className="p-6 flex flex-col gap-4">

                  {/* Hedef tipi */}
                  <div className="flex gap-2">
                    {([
                      { key: 'region', label: '📍 Bölge' },
                      { key: 'hotel',  label: '🏨 Otel'  },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setDestType(key); setRegionId(''); }}
                        className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all ${
                          destType === key
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Alış yeri */}
                  <div>
                    <label className="label">
                      <MapPin size={11} className="inline mr-1 text-emerald-500" />
                      {direction === 'AIRPORT_TO_REGION' ? 'Alış Yeri (Havalimanı)' : `Alış Yeri (${destType === 'hotel' ? 'Otel' : 'Bölge'})`}
                    </label>
                    {direction === 'AIRPORT_TO_REGION' ? (
                      airports.length > 1 ? (
                        <select
                          className="input"
                          value={resolvedAirportId}
                          onChange={(e) => setAirportId(e.target.value)}
                          required
                        >
                          <option value="">Havalimanı seçiniz…</option>
                          {airports.map((l) => (
                            <option key={l.id} value={l.id}>{locName(l)}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input bg-gray-50 text-gray-500"
                          value={airport ? locName(airport) : 'Yükleniyor…'}
                          readOnly
                        />
                      )
                    ) : (
                      <select
                        className="input"
                        value={regionId}
                        onChange={(e) => setRegionId(e.target.value)}
                        required
                      >
                        <option value="">{destType === 'hotel' ? 'Otel seçiniz…' : 'Bölge seçiniz…'}</option>
                        {destList.map((l) => (
                          <option key={l.id} value={l.id}>{locName(l)}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Bırakma yeri */}
                  <div>
                    <label className="label">
                      <MapPin size={11} className="inline mr-1 text-emerald-500" />
                      {direction === 'AIRPORT_TO_REGION' ? `Bırakma Yeri (${destType === 'hotel' ? 'Otel' : 'Bölge'})` : 'Bırakma Yeri (Havalimanı)'}
                    </label>
                    {direction === 'REGION_TO_AIRPORT' ? (
                      reachableAirports.length > 1 ? (
                        <select
                          className="input"
                          value={resolvedAirportId}
                          onChange={(e) => setAirportId(e.target.value)}
                          required
                        >
                          <option value="">Havalimanı seçiniz…</option>
                          {reachableAirports.map((l) => (
                            <option key={l.id} value={l.id}>{locName(l)}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input bg-gray-50 text-gray-500"
                          value={reachableAirports[0] ? locName(reachableAirports[0]) : (airport ? locName(airport) : 'Yükleniyor…')}
                          readOnly
                        />
                      )
                    ) : (
                      <select
                        className="input"
                        value={regionId}
                        onChange={(e) => setRegionId(e.target.value)}
                        required
                      >
                        <option value="">{destType === 'hotel' ? 'Otel seçiniz…' : 'Bölge seçiniz…'}</option>
                        {destList.map((l) => (
                          <option key={l.id} value={l.id}>{locName(l)}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Tarih + Saat */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">
                        <Calendar size={11} className="inline mr-1 text-emerald-500" />
                        Transfer Tarihi
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={date}
                        onChange={(e) => { setDate(e.target.value); setDateError(''); }}
                        min={todayStr}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">
                        <Clock size={11} className="inline mr-1 text-emerald-500" />
                        Saat
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          className="input"
                          value={hour}
                          onChange={(e) => { setHour(e.target.value); setDateError(''); }}
                        >
                          {availableHours.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <select
                          className="input"
                          value={minute}
                          onChange={(e) => { setMinute(e.target.value); setDateError(''); }}
                        >
                          {availableMinutes.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Yolcu sayıları */}
                  <div className="flex gap-6 pt-1">
                    <SpinnerInput label="Yetişkin" value={adultCount} min={1} max={20} onChange={setAdults} />
                    <SpinnerInput label="Çocuk (0–12)" value={childCount} min={0} max={10} onChange={setChildren} />
                  </div>

                  {/* Uçuş numarası */}
                  <div>
                    <label className="label">
                      <Plane size={11} className="inline mr-1 text-emerald-500" />
                      Uçuş No <span className="font-normal normal-case text-gray-400">(opsiyonel)</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="TK1234"
                      value={flightNo}
                      onChange={(e) => setFlightNo(e.target.value.toUpperCase())}
                    />
                  </div>

                  {/* Gidiş–dönüş */}
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div className="relative">
                      <input
                        id="returnFlight"
                        type="checkbox"
                        className="sr-only"
                        checked={returnFlight}
                        onChange={(e) => setReturn(e.target.checked)}
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${returnFlight ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${returnFlight ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                      Gidiş–dönüş transfer ekle
                    </span>
                  </label>

                  {dateError && (
                    <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 border border-red-100">
                      ⚠️ {dateError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="mt-1 w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <ArrowRight size={18} />
                    Transfer Ara
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll aşağı göstergesi */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={24} className="text-white/40" />
        </div>
      </section>

      <HowItWorks />
      <FeaturesSection />
      <Testimonials />
    </div>
  );
}
