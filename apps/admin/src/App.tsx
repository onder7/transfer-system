import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLayout }       from '@/components/layout/AdminLayout';
import { LoginPage }         from '@/pages/auth/LoginPage';
import { DashboardPage }     from '@/pages/dashboard/DashboardPage';
import { BookingsPage }      from '@/pages/bookings/BookingsPage';
import { DriversPage }       from '@/pages/drivers/DriversPage';
import { PricingPage }       from '@/pages/pricing/PricingPage';
import { CouponsPage }       from '@/pages/coupons/CouponsPage';
import { ExtrasPage }        from '@/pages/extras/ExtrasPage';
import { UsersPage }         from '@/pages/users/UsersPage';
import { IntegrationsPage }   from '@/pages/integrations/IntegrationsPage';
import { LocationsPage }      from '@/pages/locations/LocationsPage';
import { SystemSettingsPage } from '@/pages/settings/SystemSettingsPage';
import { VehiclesPage }       from '@/pages/vehicles/VehiclesPage';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<DashboardPage />} />
            <Route path="bookings"     element={<BookingsPage />} />
            <Route path="locations"    element={<LocationsPage />} />
            <Route path="drivers"      element={<DriversPage />} />
            <Route path="vehicles"     element={<VehiclesPage />} />
            <Route path="pricing"      element={<PricingPage />} />
            <Route path="coupons"      element={<CouponsPage />} />
            <Route path="extras"       element={<ExtrasPage />} />
            <Route path="users"        element={<UsersPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="settings"     element={<SystemSettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
