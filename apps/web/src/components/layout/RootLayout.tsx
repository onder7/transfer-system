import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Dalaman Transfer. Tüm hakları saklıdır.
        </div>
      </footer>
    </div>
  );
}
