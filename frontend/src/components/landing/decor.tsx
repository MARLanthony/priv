import React from 'react';

/**
 * Decorative floating orbs + gradient wash used behind landing sections.
 * Purely visual: `pointer-events-none` keeps every link and button clickable.
 */

interface OrbSpec {
  className: string;
  style: React.CSSProperties;
}

const HERO_ORBS: OrbSpec[] = [
  { className: 'orb orb-gold', style: { width: 420, height: 420, top: -120, left: '-8%' } },
  { className: 'orb orb-blue', style: { width: 360, height: 360, top: '18%', right: '-6%', animationDelay: '2s' } },
  { className: 'orb orb-violet', style: { width: 320, height: 320, bottom: '-6%', left: '22%', animationDelay: '4s' } },
  { className: 'orb orb-teal', style: { width: 260, height: 260, top: '52%', left: '-4%', animationDelay: '6s' } },
];

const CTA_ORBS: OrbSpec[] = [
  { className: 'orb orb-gold', style: { width: 320, height: 320, top: -90, left: '10%' } },
  { className: 'orb orb-violet', style: { width: 280, height: 280, bottom: -80, right: '8%', animationDelay: '3s' } },
];

export const FloatingOrbs: React.FC<{ variant?: 'hero' | 'cta' }> = ({ variant = 'hero' }) => {
  const orbs = variant === 'cta' ? CTA_ORBS : HERO_ORBS;

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 landing-gradient opacity-70" />
      {orbs.map((orb, index) => (
        <span key={index} className={orb.className} style={orb.style} />
      ))}
    </div>
  );
};

/** Section heading with the gold accent rule used across the page. */
export const SectionHeading: React.FC<{ eyebrow?: string; title: string; subtitle?: string; serif?: boolean }> = ({
  eyebrow,
  title,
  subtitle,
  serif = true,
}) => (
  <div className="text-center max-w-3xl mx-auto mb-14">
    {eyebrow && (
      <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold mb-4">
        {eyebrow}
      </span>
    )}
    <h2 className={`text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-5 ${serif ? 'font-display font-semibold' : 'font-bold'}`}>
      {title}
    </h2>
    <div className="gold-rule mx-auto mb-5" />
    {subtitle && <p className="text-text-secondary text-base sm:text-lg leading-relaxed">{subtitle}</p>}
  </div>
);