import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import { FloatingOrbs } from './decor';
import { fadeUp, staggerParent, viewportOnce } from './motion';

export const CTASection: React.FC = () => (
  <section id="cta" className="relative py-24 px-5 sm:px-8">
    <motion.div
      variants={staggerParent(0.12)}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className="relative max-w-5xl mx-auto"
    >
      {/* Gradient hairline border wrapper */}
      <div className="rounded-[26px] p-[1.5px] bg-gradient-to-r from-gold/50 via-gold-light/30 to-gold/50 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="relative overflow-hidden rounded-[24px] glass-premium px-6 sm:px-14 py-14 text-center">
          <FloatingOrbs variant="cta" />

          <div className="relative">
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 glass-light rounded-full text-xs text-gold mb-6 border border-gold/20"
            >
              <Sparkles size={13} />
              14-day free trial
            </motion.span>

            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-white leading-tight mb-5"
            >
              Ready to Transform Your{' '}
              <span className="bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                Legal Practice?
              </span>
            </motion.h2>

            <motion.p variants={fadeUp} className="text-text-secondary text-base sm:text-lg max-w-xl mx-auto mb-9">
              Join hundreds of firms already using JurisFlow to intake clients faster, manage cases
              calmly and keep every matter audit-ready.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4"
            >
              <Link
                to="/signup"
                className="btn-primary text-base px-8 py-3.5 inline-flex items-center justify-center gap-2 shadow-[0_14px_38px_rgba(201,168,76,0.35)]"
              >
                Start Free Trial <ArrowRight size={18} />
              </Link>
              <a
                href="mailto:sales@jurisflow.com?subject=JurisFlow%20sales%20enquiry"
                className="btn-secondary text-base px-8 py-3.5 inline-flex items-center justify-center gap-2"
              >
                <Mail size={17} className="text-gold" />
                Contact Sales
              </a>
            </motion.div>

            <motion.p variants={fadeUp} className="text-[11px] text-text-muted mt-6">
              No credit card required · 14-day free trial · Cancel anytime
            </motion.p>
          </div>
        </div>
      </div>
    </motion.div>
  </section>
);