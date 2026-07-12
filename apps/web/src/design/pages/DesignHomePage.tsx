import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Users, Briefcase, CheckCircle, ChevronLeft, ChevronRight,
  Star, Eye, Shield, ChevronDown
} from 'lucide-react';

import BookingEngine  from '@/design/components/BookingEngine';
import DesignFeatures from '@/design/components/Features';
import BookingSummary from '@/design/components/BookingSummary';
import DesignHowItWorks from '@/design/components/HowItWorks';
import DesignTestimonials from '@/design/components/Testimonials';
import VehicleDetailModal from '@/design/components/VehicleDetailModal';

import type { BookingState, TransferResult, VehicleClass } from '@/design/types';
import { useLanguage } from '@/design/context/LanguageContext';

// Yerel tarih (YYYY-MM-DD). toISOString() UTC'ye çevirdiği için TR'de (UTC+3)
// gece/sabah saatlerinde bir önceki günü verirdi — o hata giderildi.
const localDateStr = (d = new Date()) =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
const todayStr = localDateStr();

// Tarih (YYYY-MM-DD) + saat (HH:mm) → backend'in beklediği tam ISO 8601 datetime.
// Yerel saat olarak kurup toISOString ile UTC'ye çevirir (timezone offset dahil).
const toIsoDateTime = (date: string, time?: string) =>
  new Date(`${date}T${time || '00:00'}:00`).toISOString();

const LEGACY_FEATURE_LABELS: Record<string, string> = {
  water: 'Water', wifi: 'Wi-Fi', child_seat: 'Child Seat', luggage: 'Extra Luggage',
};
const featureDisplay = (f: string) => LEGACY_FEATURE_LABELS[f] ?? f;

function VehicleCard({
  result, selected, onSelect, onViewDetails, tripType,
}: {
  result: TransferResult;
  selected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
  tripType: 'one-way' | 'round-trip';
}) {
  const { t, lang } = useLanguage();
  const vc = result.vehicleClass;
  const isEn = lang === 'en';
  
  // Calculate final price based on trip type and return price if available
  let finalPrice = result.price;
  if (tripType === 'round-trip' && result.returnPrice) {
    finalPrice += result.returnPrice;
  } else if (tripType === 'round-trip') {
    // Fallback if no specific return price given by API
    finalPrice *= 1.8; 
  }

  const name = isEn && vc.nameEn ? vc.nameEn : vc.name;
  const fallbackImage = 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=800';

  return (
    <div
      className={`group bg-white rounded-3xl overflow-hidden transition-all duration-200 hover:-translate-y-1 flex flex-col ${
        selected
          ? 'ring-2 ring-emerald-500 shadow-xl shadow-emerald-100'
          : 'shadow-md hover:shadow-xl'
      }`}
    >
      <div onClick={onViewDetails} className="relative h-48 overflow-hidden cursor-pointer">
        <img
          src={vc.imageUrl || fallbackImage}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-all duration-300 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur text-slate-900 text-xs font-bold px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
            <Eye size={13} /> {t.viewDetails}
          </div>
        </div>
        {vc.isShared && (
          <span className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-sm">
            Shared Shuttle
          </span>
        )}
        {selected && (
          <div className="absolute top-3 right-3 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle size={16} className="text-white" />
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-slate-900 font-bold text-lg leading-tight">{name}</h3>
          </div>
          <div className="text-right shrink-0">
            <p className="text-slate-400 text-xs">{t.from}</p>
            <p className="text-slate-900 font-extrabold text-xl">{finalPrice.toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-500 text-xs mb-3">
          <span className="flex items-center gap-1"><Users size={12} /> {vc.capacity} {t.pax}</span>
          <span className="flex items-center gap-1"><Briefcase size={12} /> {vc.luggageCapacity} {t.bags}</span>
          <span className="flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" /> 4.9</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {vc.features.slice(0, 3).map((f) => (
            <span key={f} className="text-xs bg-gray-50 text-slate-500 px-2.5 py-1 rounded-full border border-gray-100 flex items-center gap-1">
              {featureDisplay(f)}
            </span>
          ))}
        </div>
        
        {result.surchargeApplied && (
          <p className="text-xs text-amber-600 mb-3">⚠ Night/Season surcharge applied</p>
        )}

        <div className="flex gap-2 mt-auto">
          <button
            onClick={onViewDetails}
            className="flex-none px-3 py-2.5 rounded-xl border border-gray-200 text-slate-600 text-xs font-semibold hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center gap-1.5"
          >
            <Eye size={13} /> {t.viewDetails}
          </button>
          <button
            onClick={onSelect}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              selected
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                : 'bg-slate-900 text-white hover:bg-emerald-500'
            }`}
          >
            {selected ? t.selected : t.selectVehicle}
          </button>
        </div>
      </div>
    </div>
  );
}

// Arama öncesi filo vitrini — fiyat yok, güzergah seçimine yönlendirir
function FleetPreviewCard({ vc, onReserve }: { vc: VehicleClass; onReserve: () => void }) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const name = isEn && vc.nameEn ? vc.nameEn : vc.name;
  const fallbackImage = 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=800';

  return (
    <div className="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col">
      <div className="relative h-48 overflow-hidden">
        <img
          src={vc.imageUrl || fallbackImage}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
        {vc.isShared && (
          <span className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-sm">
            Shared Shuttle
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-slate-900 font-bold text-lg leading-tight mb-2">{name}</h3>

        <div className="flex items-center gap-4 text-slate-500 text-xs mb-3">
          <span className="flex items-center gap-1"><Users size={12} /> {vc.capacity} {t.pax}</span>
          <span className="flex items-center gap-1"><Briefcase size={12} /> {vc.luggageCapacity} {t.bags}</span>
          <span className="flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" /> 4.9</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {vc.features.slice(0, 3).map((f) => (
            <span key={f} className="text-xs bg-gray-50 text-slate-500 px-2.5 py-1 rounded-full border border-gray-100">
              {featureDisplay(f)}
            </span>
          ))}
        </div>

        <button
          onClick={onReserve}
          className="mt-auto w-full py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-emerald-500 transition-all"
        >
          {isEn ? 'Select route for price' : 'Fiyat için güzergah seç'}
        </button>
      </div>
    </div>
  );
}

const DEFAULT_BOOKING: BookingState = {
  tripType: 'one-way',
  direction: 'AIRPORT_TO_REGION',
  destType: 'region',
  fromLocationId: '',
  toLocationId: '',
  date: todayStr,
  time: '',
  adultCount: 1,
  childCount: 0,
  flightNo: '',
  selectedVehicleId: null,
};

export function DesignHomePage() {
  const [booking, setBooking] = useState<BookingState>(DEFAULT_BOOKING);
  const [searchParams, setSearchParams] = useState<BookingState | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [modalResult, setModalResult] = useState<TransferResult | null>(null);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data: searchData, isFetching, isError } = useQuery({
    queryKey: ['transfers', searchParams?.fromLocationId, searchParams?.toLocationId, searchParams?.date, searchParams?.time, searchParams?.adultCount, searchParams?.childCount, searchParams?.tripType],
    queryFn: () =>
      api.get<{ results: TransferResult[] }>('/transfers/search', {
        params: {
          fromLocationId: searchParams!.fromLocationId,
          toLocationId: searchParams!.toLocationId,
          transferDate: toIsoDateTime(searchParams!.date, searchParams!.time),
          adultCount: searchParams!.adultCount,
          childCount: searchParams!.childCount,
          returnFlight: searchParams!.tripType === 'round-trip'
        }
      }).then(r => r.data),
    enabled: !!(searchParams?.fromLocationId && searchParams?.toLocationId && searchParams?.date && searchParams?.time),
  });

  // Arama öncesi vitrinde gösterilecek tüm aktif araç sınıfları
  const { data: fleetData } = useQuery({
    queryKey: ['fleet'],
    queryFn: () => api.get<{ fleet: VehicleClass[] }>('/transfers/fleet').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const fleet = fleetData?.fleet ?? [];

  // Hero arka plan görseli — admin ayarından (yoksa varsayılan)
  const { data: settingsData } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.get<{ settings: { key: string; value: string }[] }>('/settings').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const heroImage =
    settingsData?.settings.find((s) => s.key === 'hero_image_url')?.value || '/images/hero-bg.jpg';

  const scrollToBooking = () =>
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const handleSearch = () => {
    setSearchParams({ ...booking });
    document.getElementById('fleet')?.scrollIntoView({ behavior: 'smooth' });
  };

  const results = searchData?.results ?? [];
  const total = results.length;

  const handleProceed = () => {
    if (!booking.selectedVehicleId || !searchParams) return;
    const sp = new URLSearchParams();
    sp.set('fromLocationId', searchParams.fromLocationId);
    sp.set('toLocationId', searchParams.toLocationId);
    sp.set('transferDate', toIsoDateTime(searchParams.date, searchParams.time));
    sp.set('adultCount', String(searchParams.adultCount));
    sp.set('childCount', String(searchParams.childCount));
    sp.set('returnFlight', searchParams.tripType === 'round-trip' ? 'true' : 'false');
    if (searchParams.flightNo) sp.set('flightNumber', searchParams.flightNo);
    sp.set('vehicleClassId', booking.selectedVehicleId);
    
    navigate(`/booking?${sp.toString()}`);
  };

  return (
    <div className="bg-white min-h-screen font-sans antialiased">
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Luxury airport transfer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-800/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
        </div>

        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-20 w-full">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-white/90 text-xs font-semibold mb-6 tracking-wide">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                {t.heroBadge}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-5">
                {t.heroH1a} <span className="text-emerald-400">{t.heroH1b}</span>
                <br className="hidden sm:block" /> {t.heroH1c}
              </h1>
              <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                {t.heroSub}
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-5">
                {[
                  { label: '50,000+', sub: t.heroStat1Label },
                  { label: '4.9 / 5', sub: t.heroStat2Label },
                  { label: '100%',   sub: t.heroStat3Label },
                ].map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <Shield size={16} className="text-emerald-400" />
                    <div>
                      <span className="text-white font-bold text-sm">{b.label}</span>
                      <span className="text-white/50 text-xs ml-1.5">{b.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-auto lg:min-w-[520px]">
              <BookingEngine booking={booking} onChange={setBooking} onSearch={handleSearch} />
            </div>
          </div>
        </div>

        <a href="#fleet" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 hover:text-white transition-colors flex flex-col items-center gap-1 group">
          <span className="text-xs tracking-widest uppercase font-medium">{t.exploreFleet}</span>
          <ChevronDown size={20} className="animate-bounce" />
        </a>
      </section>

      <DesignHowItWorks />
      <DesignFeatures />

      <section className="bg-gray-50 py-20 px-6" id="fleet">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col xl:flex-row gap-10 items-start">
            <div className="flex-1 min-w-0">
              <div className="text-center mb-12">
                <span className="text-emerald-500 text-sm font-bold uppercase tracking-widest">{t.ourFleet}</span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-4 tracking-tight">
                  {t.chooseYourRide}
                </h2>
                <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">{t.fleetDesc}</p>
              </div>

              {!searchParams ? (
                fleet.length === 0 ? (
                  <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
                    <p className="text-slate-500">Güzergah ve tarih seçtiğinizde araçlar ve anlık fiyatlar burada listelenir.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-slate-500 text-sm mb-8">
                      Filomuzdaki araçlar aşağıda. Anlık fiyat için yukarıdan güzergah ve tarihinizi seçin.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                      {fleet.map((vc) => (
                        <FleetPreviewCard key={vc.id} vc={vc} onReserve={scrollToBooking} />
                      ))}
                    </div>
                  </>
                )
              ) : isFetching ? (
                <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
                  <p className="text-emerald-600 animate-pulse font-semibold">Searching available vehicles...</p>
                </div>
              ) : isError || results.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-red-100">
                  <p className="text-red-500">No vehicles found for this route or an error occurred. Please try different locations.</p>
                </div>
              ) : (
                <>
                  {/* Desktop grid */}
                  <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-5">
                    {results.map((r) => (
                      <VehicleCard
                        key={r.vehicleClass.id}
                        result={r}
                        selected={booking.selectedVehicleId === r.vehicleClass.id}
                        onSelect={() => setBooking(b => ({ ...b, selectedVehicleId: r.vehicleClass.id }))}
                        onViewDetails={() => setModalResult(r)}
                        tripType={booking.tripType}
                      />
                    ))}
                  </div>

                  {/* Mobile carousel */}
                  <div className="lg:hidden">
                    <div className="overflow-hidden rounded-3xl">
                      <div
                        className="flex transition-transform duration-300 ease-in-out"
                        style={{ transform: `translateX(-${carouselIdx * 100}%)` }}
                      >
                        {results.map((r) => (
                          <div key={r.vehicleClass.id} className="min-w-full px-1">
                            <VehicleCard
                              result={r}
                              selected={booking.selectedVehicleId === r.vehicleClass.id}
                              onSelect={() => setBooking(b => ({ ...b, selectedVehicleId: r.vehicleClass.id }))}
                              onViewDetails={() => setModalResult(r)}
                              tripType={booking.tripType}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-6">
                      <button onClick={() => setCarouselIdx((i) => (i - 1 + total) % total)} className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:border-emerald-400 transition-colors shadow-sm">
                        <ChevronLeft size={18} className="text-slate-600" />
                      </button>
                      <div className="flex gap-2">
                        {results.map((_, i) => (
                          <button key={i} onClick={() => setCarouselIdx(i)} className={`h-2 rounded-full transition-all ${i === carouselIdx ? 'bg-emerald-500 w-5' : 'bg-gray-300 w-2'}`} />
                        ))}
                      </div>
                      <button onClick={() => setCarouselIdx((i) => (i + 1) % total)} className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:border-emerald-400 transition-colors shadow-sm">
                        <ChevronRight size={18} className="text-slate-600" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="w-full xl:w-80 xl:shrink-0">
              <BookingSummary 
                booking={booking} 
                results={results} 
                onProceed={handleProceed} 
                searchParams={searchParams}
              />
            </div>
          </div>
        </div>
      </section>

      <DesignTestimonials />

      {modalResult && (
        <VehicleDetailModal
          result={modalResult}
          booking={booking}
          onClose={() => setModalResult(null)}
          onBook={(id) => { setBooking(b => ({ ...b, selectedVehicleId: id })); setModalResult(null); }}
        />
      )}
    </div>
  );
}
