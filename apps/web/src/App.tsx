import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootLayout }        from '@/components/layout/RootLayout';
import { DesignHomePage }    from '@/design/pages/DesignHomePage';
import { SearchPage }        from '@/pages/booking/SearchPage';
import { BookingPage }       from '@/pages/booking/BookingPage';
import { PaymentPage }       from '@/pages/booking/PaymentPage';
import { ConfirmationPage }  from '@/pages/confirmation/ConfirmationPage';
import { LoginPage }         from '@/pages/auth/LoginPage';
import { RegisterPage }      from '@/pages/auth/RegisterPage';
import { MyBookingsPage }      from '@/pages/myBookings/MyBookingsPage';
import { BookingLookupPage }  from '@/pages/bookingLookup/BookingLookupPage';
import { DriverLayout }       from '@/pages/driver/DriverLayout';
import { DriverDashboard }    from '@/pages/driver/DriverDashboard';
import { TrackingPage }        from '@/pages/tracking/TrackingPage';


const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

/**
 * Sayfa değişiminde en üste kaydırır.
 * Ana sayfada aşağıdaki filodan "Ödemeye Geç" denince /booking sayfası
 * önceki kaydırma konumunda açılıyordu; bu onu engeller.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Şoför PWA — müşteri kabuğundan bağımsız, tam ekran mobil */}
          <Route path="/surucu" element={<DriverLayout />}>
            <Route index element={<DriverDashboard />} />
          </Route>

          {/* Müşteri canlı takip haritası — tam ekran, bağımsız layout */}
          <Route path="/tracking/:bookingId" element={<TrackingPage />} />

          <Route element={<RootLayout />}>
            <Route index            element={<DesignHomePage />} />
            <Route path="search"    element={<SearchPage />} />
            <Route path="booking"   element={<BookingPage />} />
            <Route path="payment/:id"      element={<PaymentPage />} />
            <Route path="confirmation/:id" element={<ConfirmationPage />} />
            <Route path="login"      element={<LoginPage />} />
            <Route path="register"   element={<RegisterPage />} />
            <Route path="my-bookings"    element={<MyBookingsPage />} />
            <Route path="booking-lookup" element={<BookingLookupPage />} />
            <Route path="*" element={
              <div className="flex min-h-96 items-center justify-center text-gray-500">
                Sayfa bulunamadı (404)
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
