import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Landmark, Gavel, Scale, Shield, Briefcase } from 'lucide-react';
import { fadeIn, viewportOnce } from './motion';

/**
 * Trust bar: greyscale firm marks in glass pills, scrolling as a marquee.
 * The list is duplicated so the loop is seamless.
 */

const FIRMS = [
  { name: 'Harrison & Blake', icon: Building2 },
  { name: 'Meridian Law', icon: Scale },
  { name: 'Whitfield Partners', icon: Landmark },
  { name: 'Ashford Legal', icon: Shield },
  { name: 'Crown & Sterling', icon: Gavel },
  { name: 'Belford Advocates', icon: Briefcase },
];

const Pill: React.FC<{ name: string; icon: React.ElementType }> = ({ name, icon: Icon }) => (
  <div className="mx-3 flex items-center gap-2.5 px-5 py-3 glass-light rounded-2xl border border-white/10 whitespace-nowrap">
    <Icon size={16} className="text-text-muted" />
    <span className="text-sm font-medium text-text-secondary tracking-wide">{name}</span>
  </div>
);

export const TrustBar: React.FC = () => (
  <section id="trusted" className="relative py-14 border-y border-white/8">
    <motion.p
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-text-muted mb-8 px-5"
    >
      Trusted by leading law firms
    </motion.p>

    <motion.div
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className="marquee-wrap relative overflow-hidden"
    >
      <div className="marquee">
        {[...FIRMS, ...FIRMS].map((firm, index) => (
          <Pill key={`${firm.name}-${index}`} name={firm.name} icon={firm.icon} />
        ))}
      </div>
      {/* Edge fades so the marquee melts into the background */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--scrim)] to-transparent opacity-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[var(--scrim)] to-transparent opacity-40" />
    </motion.div>
  </section>
);