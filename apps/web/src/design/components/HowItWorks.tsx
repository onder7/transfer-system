import { Search, Car, Plane, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/design/context/LanguageContext';

export default function DesignHowItWorks() {
  const { t } = useLanguage();

  const steps = [
    { icon: <Search size={24} className="text-emerald-500" />, title: t.step1Title, desc: t.step1Desc },
    { icon: <Car size={24} className="text-emerald-500" />, title: t.step2Title, desc: t.step2Desc },
    { icon: <CheckCircle size={24} className="text-emerald-500" />, title: t.step3Title, desc: t.step3Desc },
    { icon: <Plane size={24} className="text-emerald-500" />, title: t.step4Title, desc: t.step4Desc },
  ];

  return (
    <section id="how-it-works" className="bg-slate-50 py-12 sm:py-20 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-emerald-500 text-sm font-bold uppercase tracking-widest">{t.simpleProcess}</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-4 tracking-tight">
            {t.howItWorksTitle}
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">{t.howItWorksDesc}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div className="hidden lg:block absolute top-14 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
          {steps.map((s, i) => (
            <div key={i} className="relative flex flex-col items-center text-center group">
              <div className="relative z-10 w-16 h-16 bg-emerald-50 group-hover:bg-emerald-100 border-2 border-emerald-100 group-hover:border-emerald-300 rounded-2xl flex items-center justify-center mb-5 transition-all duration-200 shadow-sm">
                {s.icon}
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
