import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootLayout }        from '@/components/layout/RootLayout';
import { HomePage }          from '@/pages/home/HomePage';
import { SearchPage }        from '@/pages/booking/SearchPage';
import { BookingPage }       from '@/pages/booking/BookingPage';
import { PaymentPage }       from '@/pages/booking/PaymentPage';
import { ConfirmationPage }  from '@/pages/confirmation/ConfirmationPage';
import { LoginPage }         from '@/pages/auth/LoginPage';
import { RegisterPage }      from '@/pages/auth/RegisterPage';
import { MyBookingsPage }    from '@/pages/myBookings/MyBookingsPage';

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<RootLayout />}>
            <Route index            element={<HomePage />} />
            <Route path="search"    element={<SearchPage />} />
            <Route path="booking"   element={<BookingPage />} />
            <Route path="payment/:id"      element={<PaymentPage />} />
            <Route path="confirmation/:id" element={<ConfirmationPage />} />
            <Route path="login"      element={<LoginPage />} />
            <Route path="register"   element={<RegisterPage />} />
            <Route path="my-bookings" element={<MyBookingsPage />} />
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
