import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { SectionHeading } from './decor';
import { fadeUp, staggerParent, viewportOnce } from './motion';

const TESTIMONIALS = [
  {
    quote:
      'Intake used to take our team days. JurisFlow analyses a client’s situation in seconds and routes it to the right attorney with a confidence score we can act on.',
    name: 'Sarah Whitfield',
    title: 'Managing Partner',
    firm: 'Whitfield Partners',
  },
  {
    quote:
      'The AI suggestions are remarkably accurate for our commercial work, and the document analysis flags the clauses we would otherwise spend hours marking up.',
    name: 'Daniel Okafor',
    title: 'Senior Litigator',
    firm: 'Meridian Law',
  },
  {
    quote:
      'Clients love the transparency — they see the exact facts the analysis relied on before they book. It has noticeably improved our consultation conversion.',
    name: 'Elena Marchetti',
    title: 'Head of Client Services',
    firm: 'Harrison & Blake',
  },
];

export const Testimonials: React.FC = () => (
  <section id="testimonials" className="relative py-24 px-5 sm:px-8">
    <div className="max-w-7xl mx-auto">
      <SectionHeading
        eyebrow="Testimonials"
        title="Trusted by Legal Professionals"
        subtitle="Firms of every size use JurisFlow to work faster and communicate more clearly."
      />

      <motion.div
        variants={staggerParent(0.12)}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid md:grid-cols-3 gap-6"
      >
        {TESTIMONIALS.map(item => (
          <motion.figure key={item.name} variants={fadeUp} className="glass-premium glass-premium-hover p-7 flex flex-col">
            <Quote size={26} className="text-gold mb-4 opacity-80" />

            <blockquote className="text-sm text-text-secondary italic leading-relaxed flex-1">
              “{item.quote}”
            </blockquote>

            <div className="flex items-center gap-1 mt-5 mb-5">
              {[0, 1, 2, 3, 4].map(star => (
                <Star key={star} size={14} className="text-gold fill-gold" />
              ))}
            </div>

            <figcaption className="flex items-center gap-3 pt-5 border-t border-white/10">
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-royal to-royal-light border border-white/15 flex items-center justify-center text-sm font-bold text-gold">
                {item.name
                  .split(' ')
                  .map(part => part[0])
                  .join('')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                <p className="text-[11px] text-text-muted truncate">
                  {item.title} · {item.firm}
                </p>
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </motion.div>
    </div>
  </section>
);