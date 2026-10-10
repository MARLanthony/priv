import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  FileText,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import { SectionHeading } from './decor';
import { fadeUp, staggerParent, viewportOnce } from './motion';

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: FolderOpen,
    title: 'Case Management',
    description: 'Track every case, deadline and hearing in one timeline with status, priority and owner.',
  },
  {
    icon: Brain,
    title: 'AI Suggestions',
    description: 'Describe a situation in plain language and receive case type, urgency and next steps.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description: 'A curated library of legal articles and guides that powers the AI and educates clients.',
  },
  {
    icon: CalendarDays,
    title: 'Appointment Scheduling',
    description: 'Manage consultations, court dates and availability with conflict-free booking.',
  },
  {
    icon: FileText,
    title: 'Document Management',
    description: 'Upload, organise and analyse legal documents with clause and party extraction.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Monitor firm performance, case load and client satisfaction at a glance.',
  },
];

export const Features: React.FC = () => (
  <section id="features" className="relative py-24 px-5 sm:px-8">
    <div className="max-w-7xl mx-auto">
      <SectionHeading
        eyebrow="Platform"
        title="Everything You Need to Manage Your Practice"
        subtitle="Powerful features designed for modern legal professionals — from first client contact to case closure."
      />

      <motion.div
        variants={staggerParent(0.1)}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {FEATURES.map(feature => (
          <motion.article
            key={feature.title}
            variants={fadeUp}
            className="glass-premium glass-premium-hover sheen p-7 group"
          >
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/25 to-gold/5 border border-gold/25 flex items-center justify-center mb-5 transition-transform duration-500 group-hover:scale-105">
              <feature.icon size={24} className="text-gold" />
            </span>
            <h3 className="text-lg font-semibold text-white mb-2.5">{feature.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
            <span className="block mt-5 h-px w-0 bg-gradient-to-r from-gold to-transparent transition-all duration-500 group-hover:w-16" />
          </motion.article>
        ))}
      </motion.div>
    </div>
  </section>
);