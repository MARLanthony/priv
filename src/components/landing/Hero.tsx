import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Gavel,
  Landmark,
  PlayCircle,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { FloatingOrbs } from './decor';
import { fadeUp, staggerParent } from './motion';

/** Placeholder firm marks for the hero trust badge (inline icons = no image downloads). */
const FIRM_LOGOS = [Scale, Landmark, Gavel, ShieldCheck, BarChart3];

/**
 * Full-screen hero.
 *
 * Centred single-column layout: the headline carries the message on its own,
 * with the animated gradient wash and floating orbs behind it and a scroll cue
 * at the bottom of the section.
 */
export const Hero: React.FC = () => (
  <section
    id="hero"
    className="relative min-h-screen flex items-center justify-center pt-28 pb-24 px-5 sm:px-8"
  >
    <FloatingOrbs variant="hero" />

    <motion.div
      variants={staggerParent(0.12)}
      initial="hidden"
      animate="visible"
      className="relative w-full max-w-3xl mx-auto text-center flex flex-col items-center"
    >
      <motion.span
        variants={fadeUp}
        className="inline-flex items-center gap-2 px-4 py-2 glass-light rounded-full text-xs sm:text-sm text-gold mb-7 border border-gold/20"
      >
        <Sparkles size={14} />
        AI-Powered Legal Platform
      </motion.span>

      <motion.h1
        variants={fadeUp}
        className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-[4.2rem] font-semibold text-white leading-[1.08] mb-6"
      >
        Intelligent Legal
        <br />
        Solutions for{' '}
        <span className="relative inline-block">
          <span className="bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
            Modern Firms
          </span>
          <span className="absolute -bottom-1.5 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        </span>
      </motion.h1>

      <motion.p
        variants={fadeUp}
        className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl mb-9"
      >
        Streamline case management, automate document processing, and get AI-powered legal
        suggestions — in one secure, elegant platform built for the way firms actually work.
      </motion.p>

      <motion.div
        variants={fadeUp}
        className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 mb-10"
      >
        <Link
          to="/signup"
          className="btn-primary text-base px-8 py-3.5 inline-flex items-center justify-center gap-2 shadow-[0_14px_38px_rgba(201,168,76,0.35)] hover:shadow-[0_18px_46px_rgba(201,168,76,0.45)]"
        >
          Get Started Free <ArrowRight size={18} />
        </Link>
        <a
          href="#how-it-works"
          className="btn-secondary text-base px-8 py-3.5 inline-flex items-center justify-center gap-2"
        >
          <PlayCircle size={18} className="text-gold" />
          Watch Demo
        </a>
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4"
      >
        <div className="flex -space-x-2.5">
          {FIRM_LOGOS.map((Icon, index) => (
            <span
              key={index}
              className="w-9 h-9 rounded-full glass-light border border-white/15 flex items-center justify-center"
              style={{ zIndex: FIRM_LOGOS.length - index }}
            >
              <Icon size={15} className="text-text-secondary" />
            </span>
          ))}
        </div>
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-white">Trusted by 500+ law firms</p>
          <p className="text-xs text-text-muted">Solo practices to multi-office litigation teams</p>
        </div>
      </motion.div>
    </motion.div>

    {/* Scroll indicator */}
    <motion.a
      href="#trusted"
      aria-label="Scroll to content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.2, duration: 0.8 }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted hover:text-gold transition-colors"
    >
      <span className="text-[10px] uppercase tracking-[0.28em]">Scroll</span>
      <span className="w-6 h-10 rounded-full border border-white/20 flex justify-center pt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-gold scroll-dot" />
      </span>
    </motion.a>
  </section>
);
