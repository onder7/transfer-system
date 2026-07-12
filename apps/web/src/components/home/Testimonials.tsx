import { useTranslation } from 'react-i18next';

const ITEMS = [
  { key: 't1', color: 'bg-blue-500' },
  { key: 't2', color: 'bg-pink-500' },
  { key: 't3', color: 'bg-amber-500' },
] as const;

function StarRow() {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-3 h-3 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  const { t } = useTranslation();

  return (
    <section className="bg-slate-900 py-20 px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="text-center mb-14">
          <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest">
            {t('home.testimonials.badge')}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-4 tracking-tight">
            {t('home.testimonials.title')}
          </h2>
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="text-white/60 text-sm ml-2">{t('home.testimonials.reviewsLabel')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ITEMS.map((item) => {
            const name: string = t(`home.testimonials.${item.key}.name`);
            const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2);
            return (
              <div
                key={item.key}
                className="bg-white/5 border border-white/10 rounded-3xl p-7 hover:bg-white/[0.08] transition-all hover:border-white/20"
              >
                {/* tırnak */}
                <svg className="w-7 h-7 text-emerald-500/40 mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="text-white/80 text-sm leading-relaxed mb-6">
                  {t(`home.testimonials.${item.key}.text`)}
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10`}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{t(`home.testimonials.${item.key}.name`)}</p>
                    <p className="text-white/50 text-xs">{t(`home.testimonials.${item.key}.role`)}</p>
                  </div>
                </div>
                <StarRow />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
