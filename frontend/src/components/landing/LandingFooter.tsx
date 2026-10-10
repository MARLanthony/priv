import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Scale } from 'lucide-react';
import { GitHubIcon, LinkedInIcon, XIcon, YouTubeIcon } from './socialIcons';
import { fadeUp, staggerParent, viewportOnce } from './motion';

/**
 * Footer links intentionally target either an in-page section or a mailto:
 * address — no routes are added, so nothing can 404.
 */

const PRODUCT_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#cta' },
  { label: 'Demo', href: '#how-it-works' },
  { label: 'FAQ', href: '#legal' },
];

const COMPANY_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Careers', href: 'mailto:careers@jurisflow.com?subject=Careers%20at%20JurisFlow' },
  { label: 'Blog', href: 'mailto:hello@jurisflow.com?subject=JurisFlow%20blog' },
  { label: 'Contact', href: 'mailto:hello@jurisflow.com' },
];

const LEGAL_LINKS = [
  { label: 'Privacy', href: '#legal' },
  { label: 'Terms', href: '#legal' },
  { label: 'Security', href: '#legal' },
  { label: 'Compliance', href: '#legal' },
];

const SOCIALS = [
  { label: 'LinkedIn', icon: LinkedInIcon, href: 'https://www.linkedin.com' },
  { label: 'X', icon: XIcon, href: 'https://x.com' },
  { label: 'YouTube', icon: YouTubeIcon, href: 'https://www.youtube.com' },
  { label: 'GitHub', icon: GitHubIcon, href: 'https://github.com' },
  { label: 'Email', icon: Mail, href: 'mailto:hello@jurisflow.com' },
];

const LinkColumn: React.FC<{ title: string; links: { label: string; href: string }[] }> = ({ title, links }) => (
  <div>
    <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-5">{title}</h4>
    <ul className="space-y-3">
      {links.map(link => (
        <li key={link.label}>
          <a
            href={link.href}
            className="text-sm text-text-secondary hover:text-gold transition-colors duration-300 inline-flex items-center gap-2 group"
          >
            <span className="w-0 h-px bg-gold transition-all duration-300 group-hover:w-3" />
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

export const LandingFooter: React.FC = () => (
  <footer className="relative border-t border-white/10 pt-16">
    <div className="max-w-7xl mx-auto px-5 sm:px-8">
      <motion.div
        variants={staggerParent(0.08)}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
      >
        {/* Brand */}
        <motion.div variants={fadeUp}>
          <Link to="/" className="inline-flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
              <Scale size={21} className="text-navy" />
            </span>
            <span className="text-xl font-bold text-white">
              Legal<span className="text-gold">Flow</span>
            </span>
          </Link>
          <p className="text-sm text-text-secondary leading-relaxed max-w-sm mb-6">
            AI-assisted case management, document analysis and client intake for modern legal
            practices — secure, auditable and beautifully simple.
          </p>
          <div className="flex flex-wrap gap-3">
            {SOCIALS.map(social => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                title={social.label}
                className="w-10 h-10 rounded-full glass-light border border-white/10 flex items-center justify-center text-text-secondary hover:text-gold hover:border-gold/40 hover:-translate-y-0.5 transition-all duration-300"
              >
                <social.icon size={16} />
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <LinkColumn title="Product" links={PRODUCT_LINKS} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <LinkColumn title="Company" links={COMPANY_LINKS} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <LinkColumn title="Legal" links={LEGAL_LINKS} />
        </motion.div>
      </motion.div>

      {/* Legal / compliance note (target of the Legal column links) */}
      <div id="legal" className="mt-14 scroll-mt-28 rounded-2xl glass-light border border-white/10 p-5">
        <p className="text-[11px] text-text-muted leading-relaxed">
          <span className="text-text-secondary font-medium">Privacy &amp; compliance.</span> Client
          data is processed under engagement privilege and stored with encryption at rest and in
          transit. AI output is informational and does not constitute legal advice; every
          recommendation is reviewed by a licensed attorney. Security reviews and data-processing
          terms are available on request at{' '}
          <a href="mailto:legal@jurisflow.com" className="text-gold hover:text-gold-light transition-colors">
            legal@jurisflow.com
          </a>
          .
        </p>
      </div>

      {/* Bottom bar */}
      <div className="gold-divider my-8" />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-10">
        <p className="text-xs text-text-muted">Copyright © 2026 JurisFlow. All rights reserved.</p>
        <div className="flex items-center gap-5 text-xs text-text-muted">
          <a href="#features" className="hover:text-gold transition-colors">
            Features
          </a>
          <a href="#cta" className="hover:text-gold transition-colors">
            Pricing
          </a>
          <Link to="/login" className="hover:text-gold transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  </footer>
);