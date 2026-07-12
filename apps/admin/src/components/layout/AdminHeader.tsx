import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function ServerClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const offsetMs = useRef(0); // sunucu zamanı - tarayıcı zamanı (ms)

  // Sunucu saatini bir kez al, offset hesapla
  const { data: timeData } = useQuery({
    queryKey: ['server-time'],
    queryFn: async () => {
      const t0 = Date.now();
      const res = await api.get<{ iso: string }>('/time');
      const t1 = Date.now();
      const serverMs = new Date(res.data.iso).getTime();
      // Round-trip ortasındaki sunucu zamanı tahmin et
      offsetMs.current = serverMs - Math.round((t0 + t1) / 2);
      return res.data;
    },
    staleTime: Infinity,
    refetchInterval: 5 * 60_000, // 5 dakikada bir yeniden sync
  });

  useEffect(() => {
    if (!timeData) return;
    setNow(new Date(Date.now() + offsetMs.current));
    const id = setInterval(() => setNow(new Date(Date.now() + offsetMs.current)), 1000);
    return () => clearInterval(id);
  }, [timeData]);

  if (!now) return <span className="text-gray-400 text-xs">—</span>;

  const fmtDate = new Intl.DateTimeFormat('tr-TR', {
    timeZone: timezone,
    day: '2-digit', month: 'short', year: 'numeric',
    weekday: 'short',
  }).format(now);

  const fmtTime = new Intl.DateTimeFormat('tr-TR', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(now);

  const tzAbbr = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? timezone;

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">🕐</span>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-800 tabular-nums">{fmtTime}</div>
        <div className="text-xs text-gray-400">{fmtDate} · {tzAbbr}</div>
      </div>
    </div>
  );
}

export function AdminHeader({ timezone }: { timezone: string }) {
  return (
    <header
      className="flex h-14 shrink-0 items-center justify-end gap-4 border-b border-gray-100 bg-white px-6"
    >
      <ServerClock timezone={timezone} />
    </header>
  );
}
