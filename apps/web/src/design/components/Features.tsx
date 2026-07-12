import { Plane, Shield, Clock, MapPin, Star, HeadphonesIcon } from 'lucide-react';
import { useLanguage } from '@/design/context/LanguageContext';

export default function DesignFeatures() {
  const { t } = useLanguage();

  const features = [
    { icon: <Plane size={22} className="text-emerald-500" />, title: t.feat1Title, desc: t.feat1Desc },
    { icon: <Shield size={22} className="text-emerald-500" />, title: t.feat2Title, desc: t.feat2Desc },
    { icon: <Clock size={22} className="text-emerald-500" />, title: t.feat3Title, desc: t.feat3Desc },
    { icon: <MapPin size={22} className="text-emerald-500" />, title: t.feat4Title, desc: t.feat4Desc },
    { icon: <Star size={22} className="text-emerald-500" />, title: t.feat5Title, desc: t.feat5Desc },
    { icon: <HeadphonesIcon size={22} className="text-emerald-500" />, title: t.feat6Title, desc: t.feat6Desc },
  ];

  return (
    <section id="services" className="bg-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-emerald-500 text-sm font-bold uppercase tracking-widest">{t.whyChooseUs}</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-4 tracking-tight">
            {t.featuresTitle}
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">{t.featuresDesc}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-gray-50 hover:bg-white border border-transparent hover:border-emerald-100 rounded-3xl p-7 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-50 hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center mb-5 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
