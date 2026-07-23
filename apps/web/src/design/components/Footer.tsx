import { Plane, Phone, Mail, MapPin, Instagram, Twitter, Linkedin, Facebook } from 'lucide-react';
import { useLanguage } from '@/design/context/LanguageContext';

export default function DesignFooter() {
  const { t } = useLanguage();

  const columns = [
    { title: t.footerServicesTitle, items: t.footerServices as readonly string[] },
    { title: t.footerFleetTitle,    items: t.footerFleet    as readonly string[] },
    { title: t.footerCompanyTitle,  items: t.footerCompany  as readonly string[] },
  ];

  return (
    <footer className="bg-slate-950 pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
                <Plane size={18} className="text-white -rotate-45" />
              </div>
              <span className="font-bold text-xl text-white">
                Sipahi<span className="text-emerald-500">VIP</span> Transfer
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-xs">{t.footerDesc}</p>
            <div className="flex flex-col gap-3 text-sm text-white/50">
              <a href="tel:+902525551234" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                <Phone size={14} /> +90 252 555 12 34
              </a>
              <a href="mailto:info@sipahiviptransfer.com" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                <Mail size={14} /> info@sipahiviptransfer.com
              </a>
              <span className="flex items-center gap-2">
                <MapPin size={14} /> Antalya & Muğla VIP Transfer
              </span>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-white font-bold text-sm mb-5 uppercase tracking-widest">{col.title}</h4>
              <ul className="flex flex-col gap-3">
                {col.items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-white/50 text-sm hover:text-emerald-400 transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">{t.copyright}</p>
          <div className="flex items-center gap-4">
            {[Instagram, Twitter, Linkedin, Facebook].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-9 h-9 bg-white/5 hover:bg-emerald-500 rounded-xl flex items-center justify-center transition-all hover:scale-110"
              >
                <Icon size={16} className="text-white/60" />
              </a>
            ))}
          </div>
          <div className="flex gap-5">
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">{t.privacyPolicy}</a>
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">{t.termsOfService}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
