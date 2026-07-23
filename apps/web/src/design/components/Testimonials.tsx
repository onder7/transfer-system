import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/design/context/LanguageContext';

const AVATARS = [
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200',
];

const NAMES = ['James R.', 'Sophia K.', 'Michael T.'];
const LOCATIONS = ['London Heathrow → City', 'JFK → Midtown Manhattan', 'Dubai International → Downtown'];

export default function DesignTestimonials() {
  const { t } = useLanguage();

  const testimonials = [
    { text: t.t1Text, role: t.t1Role, name: NAMES[0], avatar: AVATARS[0], location: LOCATIONS[0] },
    { text: t.t2Text, role: t.t2Role, name: NAMES[1], avatar: AVATARS[1], location: LOCATIONS[1] },
    { text: t.t3Text, role: t.t3Role, name: NAMES[2], avatar: AVATARS[2], location: LOCATIONS[2] },
  ];

  return (
    <section className="bg-slate-900 py-12 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-14">
          <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest">{t.clientStories}</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-4 tracking-tight">
            {t.trustedByThousands}
          </h2>
          <div className="flex items-center justify-center gap-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={18} className="text-amber-400 fill-amber-400" />
            ))}
            <span className="text-white/60 text-sm ml-2">{t.reviewsLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <div
              key={item.name}
              className="bg-white/5 border border-white/10 rounded-3xl p-7 hover:bg-white/[0.08] transition-all hover:border-white/20"
            >
              <Quote size={28} className="text-emerald-500/40 mb-4" />
              <p className="text-white/80 text-sm leading-relaxed mb-6">{item.text}</p>
              <div className="flex items-center gap-3 mb-4">
                <img src={item.avatar} alt={item.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-white/10" />
                <div>
                  <p className="text-white font-bold text-sm">{item.name}</p>
                  <p className="text-white/50 text-xs">{item.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <span className="text-white/40 text-xs">{item.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
