import React from 'react';
import { LandingNav } from '../components/landing/LandingNav';
import { Hero } from '../components/landing/Hero';
import { TrustBar } from '../components/landing/TrustBar';
import { Features } from '../components/landing/Features';
import { HowItWorks } from '../components/landing/HowItWorks';
import { Testimonials } from '../components/landing/Testimonials';
import { Stats } from '../components/landing/Stats';
import { CTASection } from '../components/landing/CTASection';
import { LandingFooter } from '../components/landing/LandingFooter';

/**
 * Public landing page.
 *
 * Section order: hero → trust bar → features → how it works → testimonials →
 * stats (about) → CTA → footer. Routes are unchanged: /login and /signup are the
 * only client-side navigations; everything else is an in-page anchor.
 */
export const LandingPage: React.FC = () => (
  <div className="landing-shell min-h-screen">
    <LandingNav />

    <main>
      <Hero />
      <TrustBar />
      <Features />
      <div className="gold-divider max-w-5xl mx-auto" />
      <HowItWorks />
      <Testimonials />
      <div className="gold-divider max-w-5xl mx-auto" />
      <Stats />
      <CTASection />
    </main>

    <LandingFooter />
  </div>
);
