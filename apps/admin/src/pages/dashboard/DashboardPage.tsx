import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface DashboardData {
  totalBookings:    number;
  todayTransfers:   number;
  pendingBookings:  number;
  monthRevenueTRY:  number;
  recentBookings:   Array<{
    id:           string;
    bookingRef:   string;
    guestName:    string | null;
    status:       string;
    price:        number;
    transferDate: string;
    fromLocation: { name: string };
    toLocation:   { name: string };
    payment:      { status: string; amount: number } | null;
  }>;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'badge-yellow',
  CONFIRMED: 'badge-blue',
  ASSIGNED:  'badge-blue',
  EN_ROUTE:  'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
};

const STATUS_TR: Record<string, string> = {
  PENDING: 'Bekliyor', CONFIRMED: 'Onaylandı', ASSIGNED: 'Şoför Atandı',
  EN_ROUTE: 'Yolda', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal',
};

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn:  () => api.get<DashboardData>('/admin/dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center text-gray-400">Yükleniyor…</div>
  );

  const d = data!;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat kartları */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="📋" label="Toplam Rezervasyon" value={d.totalBookings} />
        <StatCard icon="🚌" label="Bugünkü Transfer"   value={d.todayTransfers} sub="Bu gün" />
        <StatCard icon="⏳" label="Bekleyen"            value={d.pendingBookings} sub="Onay bekliyor" />
        <StatCard
          icon="💰"
          label="Aylık Gelir"
          value={`${Number(d.monthRevenueTRY).toLocaleString('tr-TR')} ₺`}
          sub="Bu ay"
        />
      </div>

      {/* Son rezervasyonlar */}
      <div className="card">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="font-semibold text-gray-900">Son Rezervasyonlar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-5 py-3 font-medium">Ref No</th>
                <th className="px-5 py-3 font-medium">Misafir</th>
                <th className="px-5 py-3 font-medium">Güzergah</th>
                <th className="px-5 py-3 font-medium">Tarih</th>
                <th className="px-5 py-3 font-medium">Tutar</th>
                <th className="px-5 py-3 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {d.recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs text-brand-600">{b.bookingRef.slice(-8)}</td>
                  <td className="px-5 py-3">{b.guestName ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {b.fromLocation.name} → {b.toLocation.name}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {new Date(b.transferDate).toLocaleDateString('tr-TR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {Number(b.payment?.amount ?? b.price).toLocaleString('tr-TR')} ₺
                  </td>
                  <td className="px-5 py-3">
                    <span className={STATUS_BADGE[b.status] ?? 'badge-gray'}>
                      {STATUS_TR[b.status] ?? b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
