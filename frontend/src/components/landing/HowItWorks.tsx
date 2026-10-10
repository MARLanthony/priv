import React from 'react';
import { motion } from 'framer-motion';
import { Brain, CalendarCheck, Gavel, PenLine, type LucideIcon } from 'lucide-react';
import { SectionHeading } from './decor';
import { fadeUp, staggerParent, viewportOnce } from './motion';

const STEPS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: PenLine,
    title: 'Describe Your Problem',
    description: 'Type your legal issue in plain English — no legal jargon required.',
  },
  {
    icon: Brain,
    title: 'AI Analyses',
    description: 'Our AI reads the facts and matches them against the firm’s legal knowledge base.',
  },
  {
    icon: Gavel,
    title: 'Get Recommendations',
    description: 'Receive the case type, confidence, required services and a matched attorney.',
  },
  {
    icon: CalendarCheck,
    title: 'Book Appointment',
    description: 'Choose an available slot and confirm a consultation with the right attorney.',
  },
];

export const HowItWorks: React.FC = () => (
  <section id="how-it-works" className="relative py-24 px-5 sm:px-8">
    <div className="max-w-7xl mx-auto">
      <SectionHeading
        eyebrow="Process"
        title="How JurisFlow Works"
        subtitle="From a client’s first description to a booked consultation in four guided steps."
      />

      <div className="relative">
        {/* Connector line between the step cards (desktop) */}
        <div className="hidden lg:block absolute top-[86px] left-[12%] right-[12%] h-px step-connector" />

        <motion.ol
          variants={staggerParent(0.14)}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {STEPS.map((step, index) => (
            <motion.li key={step.title} variants={fadeUp} className="glass-premium glass-premium-hover sheen p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-navy font-bold shadow-[0_8px_24px_rgba(201,168,76,0.35)]">
                  {index + 1}
                </span>
                <step.icon size={22} className="text-gold/80" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </div>
  </section>
);