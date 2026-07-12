import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Clock, MapPin } from 'lucide-react';

export interface RoutePoint {
  lat: number;
  lng: number;
  name: string;
}

interface Props {
  from: RoutePoint;
  to: RoutePoint;
}

// Renkli daire işaretçi (Leaflet varsayılan ikon yollarına bağımlı olmadan)
function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function fmtDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km` : `${Math.round(m)} m`;
}
function fmtDuration(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}

export default function RouteMap({ from, to }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [info, setInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const fromLL: L.LatLngTuple = [from.lat, from.lng];
    const toLL: L.LatLngTuple = [to.lat, to.lng];

    L.marker(fromLL, { icon: dotIcon('#00c875') }).addTo(map).bindTooltip(from.name, { direction: 'top' });
    L.marker(toLL, { icon: dotIcon('#0f172a') }).addTo(map).bindTooltip(to.name, { direction: 'top' });

    let routeLayer: L.Layer | null = null;
    let cancelled = false;

    const drawStraight = () => {
      routeLayer = L.polyline([fromLL, toLL], {
        color: '#00c875',
        weight: 4,
        opacity: 0.7,
        dashArray: '8 8',
      }).addTo(map);
      map.fitBounds(L.latLngBounds([fromLL, toLL]).pad(0.25));
    };

    // OSRM ile gerçek yol güzergahını çek
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('osrm'))))
      .then((data) => {
        if (cancelled) return;
        const route = data?.routes?.[0];
        if (!route?.geometry) throw new Error('no-geometry');
        routeLayer = L.geoJSON(route.geometry, {
          style: { color: '#00c875', weight: 5, opacity: 0.9 },
        }).addTo(map);
        map.fitBounds((routeLayer as L.GeoJSON).getBounds().pad(0.15));
        setInfo({ distance: route.distance, duration: route.duration });
      })
      .catch(() => {
        if (cancelled) return;
        // OSRM başarısızsa düz çizgi göster
        setFailed(true);
        drawStraight();
      });

    // Modal açılış animasyonu bitince boyutu düzelt
    const t = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [from.lat, from.lng, to.lat, to.lng, from.name, to.name]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-emerald-500" />
          <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide">Güzergah</h3>
        </div>
        {info && (
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-slate-600 font-semibold">
              <MapPin size={13} className="text-emerald-500" /> {fmtDistance(info.distance)}
            </span>
            <span className="flex items-center gap-1 text-slate-600 font-semibold">
              <Clock size={13} className="text-emerald-500" /> ~{fmtDuration(info.duration)}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <div ref={containerRef} className="h-56 w-full bg-gray-100" />
      </div>

      <div className="flex items-center justify-between mt-3 text-xs">
        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> {from.name}
        </span>
        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" /> {to.name}
        </span>
      </div>

      {failed && (
        <p className="mt-2 text-[11px] text-slate-400 text-center">
          Yol güzergahı alınamadı; kuş uçuşu hat gösteriliyor.
        </p>
      )}
    </div>
  );
}
