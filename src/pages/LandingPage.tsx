import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, Shield, Brain, Clock, Users, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="glass-navbar fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
            <Scale size={22} className="text-navy" />
          </div>
          <span className="text-xl font-bold text-white">LegalFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="btn-secondary text-sm">Sign In</Link>
          <Link to="/login" className="btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-8 max-w-7xl mx-auto">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-light rounded-full mb-8 text-sm text-gold">
            <Sparkles size={14} />
            <span>AI-Powered Legal Intelligence</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6">
            Legal Excellence,<br />
            <span className="bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
              Reimagined
            </span>
          </h1>
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Streamline your legal practice with AI-driven case management, smart document handling,
            and intelligent client consultation — all in one elegant platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="btn-primary text-base px-8 py-3 flex items-center gap-2">
              Start Free Trial <ArrowRight size={18} />
            </Link>
            <a href="#features" className="btn-secondary text-base px-8 py-3">
              Explore Features
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 stagger-children">
          {[
            { label: 'Active Cases', value: '2,500+' },
            { label: 'Attorneys', value: '150+' },
            { label: 'Resolution Rate', value: '94%' },
            { label: 'Client Rating', value: '4.9/5' },
          ].map((stat) => (
            <div key={stat.label} className="glass p-5 text-center">
              <p className="text-3xl font-bold text-gold">{stat.value}</p>
              <p className="text-sm text-text-secondary mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Powerful Features</h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            Everything your legal practice needs, designed with precision and elegance.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {[
            { icon: Brain, title: 'NLP Suggestion Engine', desc: 'Describe your legal issue and get instant AI-powered case type analysis, article recommendations, and attorney matching.' },
            { icon: Shield, title: 'Role-Based Security', desc: 'Four distinct user roles with granular permissions ensure the right people see the right information.' },
            { icon: Clock, title: 'Smart Scheduling', desc: 'Intelligent appointment booking with real-time availability tracking and automated conflict detection.' },
            { icon: Users, title: 'Team Management', desc: 'Efficiently manage attorneys, secretaries, and staff with comprehensive team oversight tools.' },
            { icon: Scale, title: 'Case Management', desc: 'End-to-end case lifecycle management with document tracking, timelines, and progress monitoring.' },
            { icon: CheckCircle2, title: 'Knowledge Base', desc: 'Curated legal articles and guides that power the NLP engine and educate clients.' },
          ].map((feature) => (
            <div key={feature.title} className="glass p-6 group hover:bg-white/12 hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                <feature.icon size={24} className="text-gold" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-8">
        <div className="max-w-4xl mx-auto glass-strong p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Transform Your Practice?</h2>
          <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
            Join leading law firms that trust LegalFlow for smarter case management and client engagement.
          </p>
          <Link to="/login" className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2">
            Get Started Today <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 px-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
            <Scale size={16} className="text-navy" />
          </div>
          <span className="text-lg font-bold text-white">LegalFlow</span>
        </div>
        <p className="text-sm text-text-muted">© 2026 LegalFlow. All rights reserved.</p>
      </footer>
    </div>
  );
};
