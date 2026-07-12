import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

// ─── Kayıtlı Müşteriler ───────────────────────────────────────────────────────

interface Customer {
  id: string; email: string; firstName: string; lastName: string;
  phone: string | null; role: string; isActive: boolean; createdAt: string;
  _count: { bookings: number };
}

function RegisteredTab() {
  const qc           = useQueryClient();
  const navigate     = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', 'CUSTOMER'],
    queryFn:  () =>
      api.get<{ users: Customer[] }>('/admin/users', { params: { role: 'CUSTOMER' } })
         .then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}/active`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users', 'CUSTOMER'] }),
  });

  const customers = (data?.users ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <input
          type="search"
          placeholder="Ad, soyad, e-posta veya telefon ara…"
          className="input max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Ad Soyad', 'E-posta', 'Telefon', 'Rezervasyon', 'Kayıt', 'Durum', 'İşlem'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                {search ? 'Arama sonucu bulunamadı.' : 'Henüz kayıtlı müşteri yok.'}
              </td></tr>
            ) : customers.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{u.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    className="text-xs font-medium text-brand-600 hover:underline"
                    onClick={() => navigate(`/bookings?search=${encodeURIComponent(u.email)}`)}
                  >
                    {u._count.bookings} rezervasyon
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                </td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                    {u.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                    className={`text-xs hover:underline ${u.isActive ? 'text-red-500' : 'text-green-600'}`}
                  >
                    {u.isActive ? 'Deaktive Et' : 'Aktive Et'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && (
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
            Toplam {data?.users?.length ?? 0} kayıtlı müşteri
            {search && customers.length !== (data?.users?.length ?? 0) && ` · ${customers.length} sonuç`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Misafir Müşteriler ───────────────────────────────────────────────────────

interface Guest {
  email:         string;
  name:          string | null;
  phone:         string | null;
  bookingCount:  number;
  lastBookingAt: string | null;
}

function GuestsTab() {
  const navigate    = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', 'guests'],
    queryFn:  () =>
      api.get<{ guests: Guest[] }>('/admin/users/guests').then((r) => r.data),
  });

  const guests = (data?.guests ?? []).filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.email.toLowerCase().includes(q) ||
      (g.name  ?? '').toLowerCase().includes(q) ||
      (g.phone ?? '').includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-4">
        <input
          type="search"
          placeholder="Ad, e-posta veya telefon ara…"
          className="input max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="text-xs text-gray-400 ml-auto">
          Üye olmadan rezervasyon yapan kişiler. Hesap oluşturmaları için e-posta gönderebilirsiniz.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Ad Soyad', 'E-posta', 'Telefon', 'Rezervasyon', 'Son Rezervasyon'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
            ) : guests.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                {search ? 'Arama sonucu bulunamadı.' : 'Henüz misafir rezervasyonu yok.'}
              </td></tr>
            ) : guests.map((g) => (
              <tr key={g.email} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium">{g.name ?? '—'}</span>
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Misafir</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{g.email}</td>
                <td className="px-4 py-3 text-gray-500">{g.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    className="text-xs font-medium text-brand-600 hover:underline"
                    onClick={() => navigate(`/bookings?search=${encodeURIComponent(g.email)}`)}
                  >
                    {g.bookingCount} rezervasyon
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {g.lastBookingAt
                    ? new Date(g.lastBookingAt).toLocaleDateString('tr-TR')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && (
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
            Toplam {data?.guests?.length ?? 0} misafir
            {search && guests.length !== (data?.guests?.length ?? 0) && ` · ${guests.length} sonuç`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

type Tab = 'registered' | 'guests';

export function UsersPage() {
  const [tab, setTab] = useState<Tab>('registered');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'registered', label: 'Kayıtlı Müşteriler' },
    { key: 'guests',     label: 'Misafir Müşteriler' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Müşteriler</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sisteme kayıtlı müşteriler ve misafir (üye olmayan) rezervasyonlar.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'registered' && <RegisteredTab />}
      {tab === 'guests'     && <GuestsTab />}
    </div>
  );
}
