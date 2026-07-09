import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLayout }    from '@/components/layout/AdminLayout';
import { LoginPage }      from '@/pages/auth/LoginPage';
import { DashboardPage }  from '@/pages/dashboard/DashboardPage';
import { BookingsPage }   from '@/pages/bookings/BookingsPage';

// Faz 7'de doldurulacak stub sayfaları
const Stub = ({ title }: { title: string }) => (
  <div className="flex h-64 items-center justify-center text-gray-400 text-lg">{title} — yakında</div>
);

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<DashboardPage />} />
            <Route path="bookings"     element={<BookingsPage />} />
            <Route path="drivers"      element={<Stub title="Şoförler" />} />
            <Route path="pricing"      element={<Stub title="Fiyatlandırma" />} />
            <Route path="coupons"      element={<Stub title="Kuponlar" />} />
            <Route path="users"        element={<Stub title="Kullanıcılar" />} />
            <Route path="integrations" element={<Stub title="Entegrasyonlar" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
