import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
// @ts-ignore — leaflet tipleri root workspace'te; buradan çözülemiyor
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';
import {
  Car, Clock, Plane, ArrowLeft, Navigation2,
} from 'lucide-react';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface TrackingData {
  bookingRef:    string;
  status:        string;  // assignment status
  bookingStatus: string;
  vehiclePlate:  string | null;
  vehicleClass:  string | null;
  driverName:    string | null;
  transferDate:  string;
  fromLocation:  { name: string; lat: number | null; lng: number | null };
  toLocation:    { name: string; lat: number | null; lng: number | null };
  flightInfo:    { status: string; delayMinutes: number | null; estimatedAt: string | null } | null;
  location:      { lat: number; lng: number; heading: number | null; speed: number | null; ts: number } | null;
}

// ─── Durum etiketleri ─────────────────────────────────────────────────────────

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  ASSIGNED:  { label: 'Şoför Atandı',    color: 'bg-blue-500',    icon: '🚗' },
  EN_ROUTE:  { label: 'Şoför Yolda',     color: 'bg-amber-500',   icon: '🛣️' },
  PICKED_UP: { label: 'Transfer Başladı', color: 'bg-emerald-500', icon: '🧍' },
  COMPLETED: { label: 'Tamamlandı',       color: 'bg-slate-500',   icon: '✅' },
};

// ─── Harita bileşeni ──────────────────────────────────────────────────────────

function TrackingMap({
  data,
}: {
  data: TrackingData;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);

  // Haritayı başlat
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([36.7128, 28.7925], 12); // Dalaman varsayılan

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Alış ve varış noktalarını ekle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = L.latLngBounds([]);

    // Alış noktası
    if (data.fromLocation.lat != null && data.fromLocation.lng != null) {
      const pos: L.LatLngExpression = [data.fromLocation.lat, data.fromLocation.lng];
      L.marker(pos, {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map).bindTooltip(data.fromLocation.name, { permanent: false, direction: 'top' });
      bounds.extend(pos);
    }

    // Varış noktası
    if (data.toLocation.lat != null && data.toLocation.lng != null) {
      const pos: L.LatLngExpression = [data.toLocation.lat, data.toLocation.lng];
      L.marker(pos, {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#0f172a;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map).bindTooltip(data.toLocation.name, { permanent: false, direction: 'top' });
      bounds.extend(pos);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.fromLocation.lat, data.toLocation.lat]);

  // Şoför konumunu güncelle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!data.location) {
      // Konum yok — marker'ı kaldır
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }

    const pos: L.LatLngExpression = [data.location.lat, data.location.lng];

    // Yön oklu araç ikonu
    const rotation = data.location.heading ?? 0;
    const driverIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:36px; height:36px; 
        display:flex; align-items:center; justify-content:center;
        background:linear-gradient(135deg,#3b82f6,#1d4ed8); 
        border-radius:50%; border:3px solid white; 
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        transform:rotate(${rotation}deg);
        transition: transform 0.5s ease;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2 L12 22 M12 2 L6 8 M12 2 L18 8"/>
        </svg>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(pos).setIcon(driverIcon);
    } else {
      driverMarkerRef.current = L.marker(pos, { icon: driverIcon })
        .addTo(map)
        .bindTooltip('Şoför', { permanent: false, direction: 'top' });
    }

    // Haritayı şoförü kapsayacak şekilde uyarla (ilk sefer)
    if (!map.getBounds().contains(pos)) {
      map.panTo(pos, { animate: true });
    }
  }, [data.location]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: '300px' }}
    />
  );
}

// ─── Ana sayfa bileşeni ───────────────────────────────────────────────────────

export function TrackingPage() {
  const { bookingId } = useParams<{ bookingId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tracking', bookingId],
    queryFn: () => api.get<TrackingData>(`/tracking/${bookingId}`).then((r) => r.data),
    refetchInterval: 5_000, // 5 saniyede bir polling
    enabled: !!bookingId,
  });

  const st = data ? STATUS_INFO[data.status] : null;
  const hasLiveLocation = !!data?.location;
  const locationAge = data?.location ? Math.round((Date.now() - data.location.ts) / 1000) : null;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Takip bilgisi yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <p className="text-5xl">🔍</p>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Takip bilgisi bulunamadı</h2>
        <p className="mt-2 text-sm text-slate-500">Bu rezervasyona henüz şoför atanmamış olabilir.</p>
        <Link to="/" className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          Ana Sayfa
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Üst bar */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to={`/confirmation/${bookingId}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">
              Canlı Transfer Takibi
            </h1>
            <p className="text-xs text-slate-500">{data.bookingRef}</p>
          </div>
          {st && (
            <span className={`shrink-0 rounded-full ${st.color} px-3 py-1 text-xs font-bold text-white`}>
              {st.icon} {st.label}
            </span>
          )}
        </div>
      </div>

      {/* Harita */}
      <div className="relative flex-1">
        <TrackingMap data={data} />

        {/* Konum durumu overlay */}
        <div className="absolute left-3 top-3 z-[1000]">
          {hasLiveLocation ? (
            <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-lg backdrop-blur-sm ring-1 ring-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Canlı konum
              {locationAge != null && locationAge > 15 && (
                <span className="text-slate-400 font-normal">({locationAge}sn önce)</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-lg backdrop-blur-sm ring-1 ring-slate-200">
              <Navigation2 size={12} className="text-slate-400" /> Konum bekleniyor…
            </div>
          )}
        </div>
      </div>

      {/* Alt bilgi kartı */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-inner">
        <div className="space-y-3">
          {/* Güzergah */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-0.5 pt-1">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div className="h-6 w-px bg-slate-300" />
              <div className="h-2.5 w-2.5 rounded-full bg-slate-800" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xs text-slate-400">Alış</p>
                <p className="text-sm font-medium text-slate-800">{data.fromLocation.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Varış</p>
                <p className="text-sm font-medium text-slate-800">{data.toLocation.name}</p>
              </div>
            </div>
          </div>

          {/* Bilgi çubuğu */}
          <div className="flex flex-wrap gap-2 text-xs">
            {data.driverName && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">
                <Car size={12} /> {data.driverName}
              </span>
            )}
            {data.vehiclePlate && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-slate-600">
                {data.vehiclePlate}
              </span>
            )}
            {data.vehicleClass && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">
                {data.vehicleClass}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">
              <Clock size={12} />
              {new Date(data.transferDate).toLocaleString('tr-TR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {data.flightInfo && (
              <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                data.flightInfo.status === 'DELAYED' ? 'bg-amber-100 text-amber-700' :
                data.flightInfo.status === 'LANDED'  ? 'bg-emerald-100 text-emerald-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                <Plane size={12} className="-rotate-45" />
                {data.flightInfo.status === 'DELAYED' ? `${data.flightInfo.delayMinutes}dk rötar` :
                 data.flightInfo.status === 'LANDED'  ? 'İndi' : 'Planlandı'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
