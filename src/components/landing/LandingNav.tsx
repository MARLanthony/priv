import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Scale, X } from 'lucide-react';

/**
 * Sticky glass navbar for the landing page.
 *
 * A single gold CTA: "Sign In" → /login. Sign-up is promoted from the hero and
 * the closing CTA section instead of crowding the bar with two buttons.
 */

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'About', href: '#about' },
];

export const LandingNav: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`landing-nav fixed top-0 left-0 right-0 z-50 ${
        scrolled ? 'landing-nav-scrolled py-3' : 'py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-[0_6px_20px_rgba(201,168,76,0.35)] transition-transform duration-300 group-hover:scale-105">
            <Scale size={22} className="text-navy" />
          </span>
          <span className="text-xl font-bold text-white tracking-tight">
            Legal<span className="text-gold">Flow</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="relative px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors duration-300 group"
            >
              {link.label}
              <span className="absolute left-4 right-4 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </a>
          ))}
        </div>

        {/* Actions — one gold CTA (the ghost Sign In button was removed) */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden sm:inline-flex btn-primary text-sm shadow-[0_8px_24px_rgba(201,168,76,0.3)]"
          >
            Sign In
          </Link>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(open => !open)}
            className="lg:hidden p-2.5 rounded-xl glass-light text-white hover:bg-white/10 transition-colors"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile glass dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden overflow-hidden px-5 sm:px-8"
          >
            <div className="glass-premium mt-3 p-4 space-y-1">
              {NAV_LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-white hover:bg-white/8 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="gold-divider my-3" />
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="btn-primary text-sm w-full inline-flex items-center justify-center"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};