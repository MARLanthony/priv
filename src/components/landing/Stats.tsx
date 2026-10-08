import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Briefcase, Headphones, Smile, Building2, type LucideIcon } from 'lucide-react';
import { SectionHeading } from './decor';
import { fadeUp, staggerParent, viewportOnce } from './motion';

/** Counts up to `target` with an ease-out curve once the block scrolls into view. */
const useCountUp = (target: number, active: boolean, duration = 1700): number => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);

  return value;
};

const Counter: React.FC<{ target: number; suffix?: string; format?: boolean }> = ({
  target,
  suffix = '',
  format = false,
}) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const value = useCountUp(target, inView);

  return (
    <p ref={ref} className="text-3xl sm:text-4xl font-bold text-gold tabular-nums">
      {format ? value.toLocaleString('en-US') : value}
      {suffix}
    </p>
  );
};

const STATS: { icon: LucideIcon; label: string; render: React.ReactNode }[] = [
  { icon: Building2, label: 'Law Firms', render: <Counter target={500} suffix="+" /> },
  { icon: Briefcase, label: 'Cases Managed', render: <Counter target={10000} suffix="+" format /> },
  { icon: Smile, label: 'Client Satisfaction', render: <Counter target={98} suffix="%" /> },
  { icon: Headphones, label: 'AI Support', render: <p className="text-3xl sm:text-4xl font-bold text-gold">24/7</p> },
];

export const Stats: React.FC = () => (
  <section id="about" className="relative py-24 px-5 sm:px-8">
    <div className="max-w-7xl mx-auto">
      <SectionHeading
        eyebrow="About JurisFlow"
        title="Built for the Modern Practice"
        subtitle="Purpose-built legal software, trusted across solo practices and multi-office litigation teams."
      />

      <motion.div
        variants={staggerParent(0.1)}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {STATS.map(stat => (
          <motion.div
            key={stat.label}
            variants={fadeUp}
            className="glass-premium glass-premium-hover p-6 text-center"
          >
            <span className="w-11 h-11 mx-auto mb-4 rounded-2xl bg-gold/12 border border-gold/25 flex items-center justify-center">
              <stat.icon size={20} className="text-gold" />
            </span>
            {stat.render}
            <p className="text-xs sm:text-sm text-text-secondary mt-2">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);