import { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Calendar, ArrowRight, PlaneTakeoff, PlaneLanding, Building, Home, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BookingState, Location } from '@/design/types';
import { useLanguage } from '@/design/context/LanguageContext';

interface Props {
  booking: BookingState;
  onChange: (b: BookingState) => void;
  onSearch: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

// Özel Select Bileşeni (CSS stillendirmesi yapılabilen)
function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  disabled 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { id: string; label: string }[]; 
  placeholder: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.id === value);

  return (
    <div className={`relative w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={ref}>
      <div 
        className="flex items-center justify-between cursor-pointer py-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-[14px] font-semibold truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-[100] top-[calc(100%+12px)] left-[-16px] right-[-16px] bg-white border border-emerald-100 rounded-2xl shadow-[0_10px_40px_rgba(0,200,117,0.15)] max-h-64 overflow-y-auto py-2">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-[14px] text-slate-500 font-medium text-center">Kayıt bulunamadı</div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`px-5 py-3 text-[14px] font-bold cursor-pointer transition-colors ${
                  value === opt.id 
                    ? 'bg-emerald-50/70 text-[#00c875]' 
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#00c875]'
                }`}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function BookingEngine({ booking, onChange, onSearch }: Props) {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  const update = (patch: Partial<BookingState>) => onChange({ ...booking, ...patch });

  // 1. Fetch Locations & Routes
  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ locations: Location[] }>('/locations').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.get<{ routes: { fromLocationId: string; toLocationId: string }[] }>('/locations/routes').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['public-settings'],
    queryFn:  () => api.get<{ settings: { key: string; value: string }[] }>('/settings').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const locations = locData?.locations ?? [];
  const routes = routesData?.routes ?? [];
  const minAdvanceMin = parseInt(settingsData?.settings.find((s) => s.key === 'min_advance_minutes')?.value ?? '60', 10);

  // Fiyatı tanımlı olmayan lokasyonlar müşteri formunda GÖSTERİLMEZ.
  // routes = fiyat matrisinde tanımlı güzergah çiftleri; bir lokasyon en az bir
  // güzergahta geçmiyorsa o noktaya/noktadan transfer satılamaz.
  const pricedIds = useMemo(
    () => new Set(routes.flatMap((r) => [r.fromLocationId, r.toLocationId])),
    [routes],
  );
  const hasPricing = pricedIds.size > 0;

  const byType = (t: string) => locations.filter((l) => l.type === t && pricedIds.has(l.id));
  const airports  = useMemo(() => byType('airport'), [locations, pricedIds]);
  const allRegions = useMemo(() => byType('region'), [locations, pricedIds]);
  const allHotels  = useMemo(() => byType('hotel'),  [locations, pricedIds]);

  // Handle Direction Logic
  const isAirportToRegion = booking.direction === 'AIRPORT_TO_REGION';

  const fromLabel = isAirportToRegion ? 'Alış Yeri (Havalimanı)' : `Alış Yeri (${booking.destType === 'hotel' ? 'Otel' : 'Bölge'})`;
  const toLabel = isAirportToRegion ? `Bırakma Yeri (${booking.destType === 'hotel' ? 'Otel' : 'Bölge'})` : 'Bırakma Yeri (Havalimanı)';

  // Calculate available destinations based on selected source and routes
  const reachableFromSource = useMemo(() => {
    if (!booking.fromLocationId || !routes.length) return null;
    const ids = new Set<string>();
    routes.forEach((r) => {
      if (r.fromLocationId === booking.fromLocationId) ids.add(r.toLocationId);
      if (r.toLocationId === booking.fromLocationId) ids.add(r.fromLocationId);
    });
    return ids;
  }, [routes, booking.fromLocationId]);

  const targetList = booking.destType === 'hotel' ? allHotels : allRegions;

  // Final lists for dropdowns
  // Alış yeri listesi ASLA kendi seçimine göre filtrelenmez (aksi halde boşalır → "Kayıt bulunamadı").
  // Yalnızca bırakma yeri, seçilen alış yerinden ulaşılabilen noktalara göre filtrelenir.
  const fromList = isAirportToRegion ? airports : targetList;
  const toList = isAirportToRegion
    ? (reachableFromSource ? targetList.filter((l) => reachableFromSource.has(l.id)) : targetList)
    : (reachableFromSource ? airports.filter((l) => reachableFromSource.has(l.id)) : airports);

  // Clear selections when changing direction or type to prevent invalid states
  useEffect(() => {
    update({ fromLocationId: '', toLocationId: '' });
  }, [booking.direction, booking.destType]);

  // 3. Time restrictions
  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  // Geçmiş tarih kalırsa (eskimiş varsayılan veya gece yarısı geçişi) bugüne çek
  useEffect(() => {
    if (!booking.date || booking.date < todayStr) {
      update({ date: todayStr });
    }
  }, [todayStr, booking.date]);

  const isToday = booking.date === todayStr;
  const earliest = new Date(Date.now() + minAdvanceMin * 60_000);
  const nowHour = earliest.getHours();
  const nowMin = earliest.getMinutes();

  const availableHours = useMemo(() => {
    if (!isToday) return HOURS;
    return HOURS.filter((h) => {
      const hNum = Number(h);
      if (hNum > nowHour) return true;
      if (hNum === nowHour) return MINUTES.some((m) => Number(m) > nowMin);
      return false;
    });
  }, [isToday, nowHour, nowMin]);

  const [selHour, selMin] = booking.time ? booking.time.split(':') : [availableHours[0] || '12', '00'];

  const availableMinutes = useMemo(() => {
    if (!isToday || Number(selHour) > nowHour) return MINUTES;
    return MINUTES.filter((m) => Number(m) > nowMin);
  }, [isToday, selHour, nowHour, nowMin]);

  // İlk yüklemede booking.time boşsa görüntülenen varsayılan saati state'e yaz;
  // ayrıca seçili saat geçersiz kaldıysa ilk geçerli saate sıfırla. Böylece hem
  // "Transfer Ara" butonu açılır hem de özet kartında saat görünür.
  useEffect(() => {
    if (availableHours.length > 0 && (!booking.time || !availableHours.includes(selHour))) {
      update({ time: `${availableHours[0]}:${availableMinutes[0] || '00'}` });
    }
  }, [availableHours, selHour, booking.time]);

  const isSearchDisabled = !booking.fromLocationId || !booking.toLocationId || !booking.date || !booking.time;

  return (
    <div id="booking" className="bg-white rounded-[24px] shadow-2xl shadow-slate-900/10 overflow-hidden w-full max-w-[560px] mx-auto font-sans p-6 sm:p-8 flex flex-col gap-6">

      {/* Fiyatlandırılmış güzergah yoksa form kullanılamaz — net bilgi ver */}
      {!hasPricing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Şu anda çevrimiçi rezervasyona açık güzergah bulunmuyor. Lütfen daha sonra tekrar deneyin
          veya bizimle iletişime geçin.
        </div>
      )}

      {/* TRANSFER YÖNÜ */}
      <div>
        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Transfer Yönü</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ direction: 'AIRPORT_TO_REGION' })}
            className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border-2 ${
              isAirportToRegion
                ? 'border-[#00c875] text-[#00c875] bg-emerald-50/50'
                : 'border-gray-200 text-slate-500 hover:border-emerald-300'
            }`}
          >
            <PlaneLanding size={18} /> Havalimanı → Bölge
          </button>
          <button
            type="button"
            onClick={() => update({ direction: 'REGION_TO_AIRPORT' })}
            className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border-2 ${
              !isAirportToRegion
                ? 'border-[#00c875] text-[#00c875] bg-emerald-50/50'
                : 'border-gray-200 text-slate-500 hover:border-emerald-300'
            }`}
          >
            <Home size={18} /> Bölge → Havalimanı
          </button>
        </div>
      </div>

      {/* BÖLGE / OTEL SEÇİMİ */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => update({ destType: 'region' })}
          className={`py-2.5 px-5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${
            booking.destType === 'region'
              ? 'bg-[#00c875] border-[#00c875] text-white'
              : 'border-gray-200 text-slate-500 hover:border-emerald-300'
          }`}
        >
          <MapPin size={16} /> Bölge
        </button>
        <button
          type="button"
          onClick={() => update({ destType: 'hotel' })}
          className={`py-2.5 px-5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${
            booking.destType === 'hotel'
              ? 'bg-[#00c875] border-[#00c875] text-white'
              : 'border-gray-200 text-slate-500 hover:border-emerald-300'
          }`}
        >
          <Building size={16} /> Otel
        </button>
      </div>

      {/* LOKASYONLAR */}
      <div className="grid grid-cols-2 gap-4 relative">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">{fromLabel}</label>
          <div className="flex items-center gap-3 bg-[#fcfcfc] rounded-2xl px-4 py-3 border border-gray-200 hover:border-[#00c875] transition-all">
            <CustomSelect
              value={booking.fromLocationId}
              onChange={(val) => update({ fromLocationId: val })}
              options={fromList.map(loc => ({ id: loc.id, label: isEn && loc.nameEn ? loc.nameEn : loc.name }))}
              placeholder="Seçiniz..."
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">{toLabel}</label>
          <div className="flex items-center gap-3 bg-[#fcfcfc] rounded-2xl px-4 py-3 border border-gray-200 hover:border-[#00c875] transition-all">
            <CustomSelect
              value={booking.toLocationId}
              onChange={(val) => update({ toLocationId: val })}
              disabled={!booking.fromLocationId}
              options={toList.map(loc => ({ id: loc.id, label: isEn && loc.nameEn ? loc.nameEn : loc.name }))}
              placeholder={!booking.fromLocationId ? 'Önce Alış Yeri Seçin' : 'Seçiniz...'}
            />
          </div>
        </div>
      </div>

      {/* TARİH VE SAAT */}
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Transfer Tarihi</label>
          <div className="flex items-center gap-3 bg-[#fcfcfc] rounded-2xl px-4 py-3.5 border border-gray-200 focus-within:border-[#00c875] focus-within:ring-1 focus-within:ring-[#00c875] transition-all">
            <Calendar size={18} className="text-[#00c875] shrink-0" />
            <input
              type="date"
              min={todayStr}
              value={booking.date}
              onChange={(e) => update({ date: e.target.value })}
              className="bg-transparent text-slate-700 text-[14px] font-semibold outline-none w-full cursor-pointer"
            />
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Saat</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#fcfcfc] rounded-2xl px-3 py-3.5 border border-gray-200 focus-within:border-[#00c875] transition-all">
              <select 
                value={selHour} 
                onChange={(e) => update({ time: `${e.target.value}:${selMin}` })}
                className="bg-transparent text-slate-700 text-[14px] w-full font-semibold outline-none appearance-none cursor-pointer text-center"
              >
                {availableHours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <span className="text-slate-400 font-bold">:</span>
            <div className="flex-1 bg-[#fcfcfc] rounded-2xl px-3 py-3.5 border border-gray-200 focus-within:border-[#00c875] transition-all">
              <select 
                value={selMin} 
                onChange={(e) => update({ time: `${selHour}:${e.target.value}` })}
                className="bg-transparent text-slate-700 text-[14px] w-full font-semibold outline-none appearance-none cursor-pointer text-center"
              >
                {availableMinutes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* YETİŞKİN VE ÇOCUK */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Yetişkin</label>
          <div className="flex items-center gap-3 bg-[#fcfcfc] rounded-2xl px-3 py-3 border border-gray-200">
            <button
              type="button"
              onClick={() => update({ adultCount: Math.max(1, booking.adultCount - 1) })}
              className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-slate-500 hover:bg-white hover:border-[#00c875] transition-all text-xl leading-none bg-white shadow-sm"
            >
              −
            </button>
            <span className="flex-1 text-center text-[15px] font-bold text-slate-800">
              {booking.adultCount}
            </span>
            <button
              type="button"
              onClick={() => update({ adultCount: Math.min(16, booking.adultCount + 1) })}
              className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-slate-500 hover:bg-white hover:border-[#00c875] transition-all text-xl leading-none bg-white shadow-sm"
            >
              +
            </button>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Çocuk (0-12 yaş)</label>
          <div className="flex items-center gap-3 bg-[#fcfcfc] rounded-2xl px-3 py-3 border border-gray-200">
            <button
              type="button"
              onClick={() => update({ childCount: Math.max(0, booking.childCount - 1) })}
              className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-slate-500 hover:bg-white hover:border-[#00c875] transition-all text-xl leading-none bg-white shadow-sm"
            >
              −
            </button>
            <span className="flex-1 text-center text-[15px] font-bold text-slate-800">
              {booking.childCount}
            </span>
            <button
              type="button"
              onClick={() => update({ childCount: Math.min(16, booking.childCount + 1) })}
              className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-slate-500 hover:bg-white hover:border-[#00c875] transition-all text-xl leading-none bg-white shadow-sm"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* UÇUŞ NUMARASI */}
      <div>
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Uçuş Numarası (Opsiyonel)</label>
        <div className="flex items-center gap-3 bg-[#fcfcfc] rounded-2xl px-4 py-3.5 border border-gray-200 focus-within:border-[#00c875] focus-within:ring-1 focus-within:ring-[#00c875] transition-all">
          <PlaneTakeoff size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="TK1234"
            value={booking.flightNo || ''}
            onChange={(e) => update({ flightNo: e.target.value })}
            className="bg-transparent text-slate-700 text-[14px] font-semibold outline-none w-full"
          />
        </div>
      </div>

      {/* GİDİŞ DÖNÜŞ CHECKBOX */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer group w-max">
          <button
            type="button"
            onClick={() => update({ tripType: booking.tripType === 'one-way' ? 'round-trip' : 'one-way' })}
            className="text-[#00c875]"
          >
            {booking.tripType === 'round-trip' ? <CheckSquare size={22} /> : <Square size={22} className="text-gray-300 group-hover:text-[#00c875]" />}
          </button>
          <span className="text-[14px] font-semibold text-slate-700 select-none">Gidiş-dönüş transfer ekle</span>
        </label>

        {booking.tripType === 'round-trip' && (
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
            <div>
              <label className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-2 block">Dönüş Tarihi</label>
              <div className="flex items-center gap-3 bg-white rounded-xl px-3 py-3 border border-emerald-200 focus-within:border-[#00c875] transition-all">
                <Calendar size={16} className="text-[#00c875] shrink-0" />
                <input
                  type="date"
                  min={booking.date || todayStr}
                  value={booking.returnDate || ''}
                  onChange={(e) => update({ returnDate: e.target.value })}
                  className="bg-transparent text-slate-700 text-[14px] font-semibold outline-none w-full cursor-pointer"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-2 block">Dönüş Saati</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-xl px-2 py-3 border border-emerald-200">
                  <select 
                    value={booking.returnTime?.split(':')[0] || '12'} 
                    onChange={(e) => update({ returnTime: `${e.target.value}:${booking.returnTime?.split(':')[1] || '00'}` })}
                    className="bg-transparent text-slate-700 text-[14px] w-full font-semibold outline-none appearance-none cursor-pointer text-center"
                  >
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <span className="text-slate-400 font-bold">:</span>
                <div className="flex-1 bg-white rounded-xl px-2 py-3 border border-emerald-200">
                  <select 
                    value={booking.returnTime?.split(':')[1] || '00'} 
                    onChange={(e) => update({ returnTime: `${booking.returnTime?.split(':')[0] || '12'}:${e.target.value}` })}
                    className="bg-transparent text-slate-700 text-[14px] w-full font-semibold outline-none appearance-none cursor-pointer text-center"
                  >
                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onSearch();
        }}
        disabled={isSearchDisabled}
        className="mt-2 bg-[#00c875] disabled:bg-gray-300 disabled:shadow-none hover:bg-[#00b065] active:scale-[0.98] text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-[0_8px_16px_rgba(0,200,117,0.3)] hover:shadow-[0_12px_24px_rgba(0,200,117,0.4)] flex items-center justify-center gap-2 group"
      >
        Transfer Ara
        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
      </button>

    </div>
  );
}
