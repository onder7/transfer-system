import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function SiteFooter() {
  const { t } = useTranslation();

  const columns = [
    { titleKey: 'home.footer.servicesTitle', itemsKey: 'home.footer.services' },
    { titleKey: 'home.footer.fleetTitle',    itemsKey: 'home.footer.fleet'    },
    { titleKey: 'home.footer.companyTitle',  itemsKey: 'home.footer.company'  },
  ] as const;

  return (
    <footer className="bg-slate-950 pt-16 pb-8 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
          {/* Marka bilgisi */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg -rotate-45 inline-block">✈</span>
              </div>
              <span className="font-bold text-xl text-white">
                Sipahi<span className="text-emerald-500">VIP</span> Transfer
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-xs">
              {t('home.footer.desc')}
            </p>
            <div className="flex flex-col gap-3 text-sm text-white/50">
              <a href="tel:+902525551234" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                📞 +90 252 555 12 34
              </a>
              <a href="mailto:info@sipahiviptransfer.com" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                ✉️ info@sipahiviptransfer.com
              </a>
              <span className="flex items-center gap-2">
                📍 Antalya & Muğla VIP Transfer
              </span>
            </div>
          </div>

          {/* Link sütunları */}
          {columns.map((col) => {
            const items = t(col.itemsKey, { returnObjects: true }) as string[];
            return (
              <div key={col.titleKey}>
                <h4 className="text-white font-bold text-sm mb-5 uppercase tracking-widest">
                  {t(col.titleKey)}
                </h4>
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <li key={item}>
                      <a href="#" className="text-white/50 text-sm hover:text-emerald-400 transition-colors">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Alt çubuk */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">{t('home.footer.copyright')}</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="text-white/30 text-xs hover:text-white/60 transition-colors no-underline">
              {t('home.footer.privacy')}
            </Link>
            <Link to="/terms" className="text-white/30 text-xs hover:text-white/60 transition-colors no-underline">
              {t('home.footer.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
