import { Plane, Shield, Clock, MapPin, Star, Headphones } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FEATURES = [
  { icon: Plane,       key: 'f1', color: 'text-emerald-500' },
  { icon: Shield,      key: 'f2', color: 'text-emerald-500' },
  { icon: Clock,       key: 'f3', color: 'text-emerald-500' },
  { icon: MapPin,      key: 'f4', color: 'text-emerald-500' },
  { icon: Star,        key: 'f5', color: 'text-emerald-500' },
  { icon: Headphones,  key: 'f6', color: 'text-emerald-500' },
] as const;

export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section id="services" className="bg-slate-50 py-20 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-14">
          <span className="text-emerald-600 text-sm font-bold uppercase tracking-widest">
            {t('home.featuresExt.badge')}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-4 tracking-tight">
            {t('home.featuresExt.title')}
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
            {t('home.featuresExt.desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.key}
                className="group bg-white hover:bg-white border border-transparent hover:border-emerald-100 rounded-3xl p-7 transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-200">
                  <Icon size={22} className={f.color} />
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">
                  {t(`home.featuresExt.${f.key}.title`)}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {t(`home.featuresExt.${f.key}.desc`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
