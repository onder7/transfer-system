import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import DesignFooter from '@/design/components/Footer';
import { LanguageProvider } from '@/design/context/LanguageContext';

export function RootLayout() {
  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        {/* Navbar fixed olduğu için her sayfa kendi pt'sini yönetiyor */}
        <main className="flex-1">
          <Outlet />
        </main>
        <DesignFooter />
      </div>
    </LanguageProvider>
  );
}
