/*
 * Landing page test: SSR-renders the redesigned marketing page and asserts the
 * section inventory, copy, routes, glassmorphism effects and animation wiring.
 *
 *   node node_modules/esbuild/bin/esbuild tests/landing-test.tsx --bundle --format=cjs --platform=node --jsx=automatic --outfile=.smoke/landing.cjs
 *   node .smoke/landing.cjs
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { LandingPage } from '../src/pages/LandingPage';

declare const process: { exitCode?: number };

let failed = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) failed += 1;
};

const decode = (html: string): string =>
  html
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const html = decode(
  renderToStaticMarkup(
    React.createElement(MemoryRouter, { initialEntries: ['/'] }, React.createElement(LandingPage)),
  ),
);

const css = readFileSync('src/index.css', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
};

const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/* --- sections ---------------------------------------------------------------- */
const SECTION_IDS = ['hero', 'trusted', 'features', 'how-it-works', 'testimonials', 'about', 'cta', 'legal'];
for (const id of SECTION_IDS) {
  check(`section #${id} rendered`, html.includes(`id="${id}"`));
}

/* --- navbar ------------------------------------------------------------------ */
/** Just the sticky bar, so nav-level assertions can't be satisfied by the page body. */
const navHtml = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));

check('nav: brand rendered', html.includes('Legal') && html.includes('Flow'));
check('nav: desktop links', ['Features', 'How It Works', 'Testimonials', 'About'].every(label => html.includes(`>${label}<`)));
check('nav: links point at real anchors', ['#features', '#how-it-works', '#testimonials', '#about'].every(href => html.includes(`href="${href}"`)));
check('nav: single gold CTA labelled Sign In', navHtml.includes('>Sign In<') && navHtml.includes('btn-primary text-sm shadow-'));
check('nav: CTA signs users in at /login', navHtml.includes('href="/login"'));
check('nav: ghost secondary button removed', !navHtml.includes('btn-secondary'));
check('nav: Get Started no longer crowds the bar', !navHtml.includes('Get Started') && !navHtml.includes('href="/signup"'));
check('nav: signup still promoted in the page body', html.includes('href="/signup"'));
check('nav: mobile toggle has a11y label', html.includes('aria-label="Open menu"') && html.includes('aria-expanded="false"'));
check('nav: sticky transparent bar', html.includes('landing-nav ') && html.includes('fixed top-0'));
check('nav: becomes glassy on scroll (CSS)', /\.landing-nav-scrolled \{[\s\S]*?backdrop-filter: blur\(24px\)/.test(css) && /\.landing-nav-scrolled \{[\s\S]*?var\(--surface-navbar\)/.test(css));

/* --- hero -------------------------------------------------------------------- */
check('hero: badge', html.includes('AI-Powered Legal Platform'));
check('hero: headline (serif)', html.includes('font-display') && html.includes('Intelligent Legal'));
check('hero: headline accent', html.includes('Modern Firms'));
check('hero: subheadline mentions AI suggestions', html.includes('AI-powered legal suggestions'));
check('hero: primary CTA', html.includes('Get Started Free'));
check('hero: secondary CTA / demo', html.includes('Watch Demo'));
check('hero: demo CTA targets how-it-works', html.includes('href="#how-it-works"'));
check('hero: trust badge', html.includes('Trusted by 500+ law firms'));
check('hero: copy is centred (no side visual)', html.includes('text-center flex flex-col items-center') && !html.includes('lg:grid-cols-[1.05fr_0.95fr]'));
check('hero: side mockup removed', !html.includes('case overview') && !html.includes('Matter analysed') && !html.includes('Terraform v. GreenVolt'));
check('hero: CTAs centred', html.includes('items-center justify-center gap-4 mb-10'));
check('hero: scroll indicator', html.includes('scroll-dot') && html.includes('>Scroll<'));

/* --- trust bar --------------------------------------------------------------- */
check('trust bar: heading', html.includes('Trusted by leading law firms'));
check('trust bar: marquee', html.includes('marquee-wrap') && html.includes('class="marquee"'));
check('trust bar: logo list duplicated for a seamless loop', countOf(html, 'Ashford Legal') === 2, `copies=${countOf(html, 'Ashford Legal')}`);

/* --- features ---------------------------------------------------------------- */
check('features: section title', html.includes('Everything You Need to Manage Your Practice'));
check('features: subtitle', html.includes('Powerful features designed for modern legal professionals'));
const FEATURES = [
  'Case Management',
  'AI Suggestions',
  'Knowledge Base',
  'Appointment Scheduling',
  'Document Management',
  'Analytics Dashboard',
];
check('features: all six cards', FEATURES.every(title => html.includes(`>${title}<`)), `missing: ${FEATURES.filter(t => !html.includes(`>${t}<`)).join(',') || 'none'}`);
check('features: hover lift + gold border classes', html.includes('glass-premium-hover') && html.includes('sheen'));

/* --- how it works ------------------------------------------------------------ */
check('how it works: section title', html.includes('How JurisFlow Works'));
const STEPS = ['Describe Your Problem', 'AI Analyses', 'Get Recommendations', 'Book Appointment'];
check('how it works: four steps', STEPS.every(step => html.includes(`>${step}<`)));
check('how it works: numbered badges', ['>1<', '>2<', '>3<', '>4<'].every(n => html.includes(n)));
check('how it works: connector line', html.includes('step-connector'));

/* --- testimonials ------------------------------------------------------------ */
check('testimonials: section title', html.includes('Trusted by Legal Professionals'));
check('testimonials: three cards', countOf(html, '<figure') === 3, `figures=${countOf(html, '<figure')}`);
check('testimonials: five stars each', countOf(html, 'class="lucide lucide-star') === 15, `stars=${countOf(html, 'class="lucide lucide-star')}`);
check('testimonials: quote icon', html.includes('lucide-quote'));
check('testimonials: names + firms', html.includes('Sarah Whitfield') && html.includes('Whitfield Partners') && html.includes('Daniel Okafor') && html.includes('Elena Marchetti'));

/* --- stats ------------------------------------------------------------------- */
check('stats: about heading', html.includes('Built for the Modern Practice'));
check('stats: four metrics', ['Law Firms', 'Cases Managed', 'Client Satisfaction', 'AI Support'].every(label => html.includes(`>${label}<`)));
check('stats: 24/7 support shown', html.includes('24/7'));
check('stats: counters start from zero (SSR, animate in view)', html.includes('tabular-nums') && html.includes('>0+<') && html.includes('>0%<'));

/* --- CTA --------------------------------------------------------------------- */
check('cta: headline', html.includes('Ready to Transform Your') && html.includes('Legal Practice?'));
check('cta: primary button', html.includes('Start Free Trial'));
check('cta: secondary button', html.includes('Contact Sales'));
check('cta: trial reassurance', html.includes('No credit card required'));
check('cta: sales link functional', html.includes('mailto:sales@jurisflow.com'));
check('cta: gradient hairline border', html.includes('bg-gradient-to-r from-gold/50'));

/* --- footer ------------------------------------------------------------------ */
check('footer: four column titles', ['Product', 'Company', 'Legal'].every(t => html.includes(`>${t}<`)) && html.includes('Legal') && html.includes('Flow'));
check('footer: product links', ['Features', 'Pricing', 'Demo', 'FAQ'].every(l => html.includes(`>${l}<`)));
check('footer: company links', ['About', 'Careers', 'Blog', 'Contact'].every(l => html.includes(`>${l}<`)));
check('footer: legal links', ['Privacy', 'Terms', 'Security', 'Compliance'].every(l => html.includes(`>${l}<`)));
check('footer: copyright', html.includes('Copyright © 2026 JurisFlow. All rights reserved.'));
check('footer: social icons', ['LinkedIn', 'X', 'YouTube', 'GitHub', 'Email'].every(s => html.includes(`aria-label="${s}"`)));
check('footer: no broken external brand icon imports', html.includes('<svg') && countOf(html, 'aria-hidden="true"') >= 4);

/* --- glassmorphism + motion wiring ------------------------------------------- */
check('glass: premium surface used', countOf(html, 'glass-premium') >= 15, `uses=${countOf(html, 'glass-premium')}`);
check('glass: orbs rendered', countOf(html, 'class="orb ') >= 6, `orbs=${countOf(html, 'class="orb ')}`);
check('glass: animated gradient', countOf(html, 'landing-gradient') >= 1);
check('glass: gold accent rules', countOf(html, 'gold-rule') >= 3, `rules=${countOf(html, 'gold-rule')}`);
check('glass: section dividers', countOf(html, 'gold-divider') >= 3);
check('motion: framer-motion is a dependency', Boolean(pkg.dependencies['framer-motion']));
check('motion: reveal wrappers keep content in SSR', html.includes('Intelligent Legal') && html.includes('Built for the Modern Practice'));
check('css: glass-premium definition present', css.includes('.glass-premium {'));
check('css: orbs are blurred + non-interactive', /\.orb \{[\s\S]*?filter: blur/.test(css) && /\.orb \{[\s\S]*?pointer-events: none/.test(css));
check('css: gradient drift animation', css.includes('@keyframes gradientDrift') && css.includes('animation: gradientDrift'));
check('css: orb float animation', css.includes('@keyframes orbFloat'));
check('css: marquee animation', css.includes('@keyframes marqueeScroll'));
check('css: scroll indicator animation', css.includes('@keyframes scrollDot'));
check('css: reduces motion for accessibility', css.includes('@media (prefers-reduced-motion: reduce)') && /prefers-reduced-motion[\s\S]*?\.orb[\s\S]*?animation: none/.test(css));
check('css: light theme keeps glass readable', /\[data-theme='light'\] \.glass-premium/.test(css));
check('css: theme swatches preserved', css.includes('.theme-preview-normal') && css.includes('.theme-preview-dark') && css.includes('.theme-preview-light'));

/* --- routes / links ---------------------------------------------------------- */
check('routes: only /, /login + /signup are app links', (() => {
  const allowed = ['/', '/login', '/signup'];
  const internal = [...html.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1]);
  return internal.every(href => allowed.includes(href));
})(), [...html.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1]).join(',') || 'none');
check('links: every anchor is closed (no nested <a>)', (() => {
  let depth = 0;
  for (const tag of html.matchAll(/<\/?a\b/g)) {
    depth += tag[0] === '</a' ? -1 : 1;
    if (depth > 1) return false;
    if (depth < 0) return false;
  }
  return depth === 0;
})());
check('links: mailto targets use a real address', !html.includes('href="mailto:"') && html.includes('mailto:hello@jurisflow.com'));
check('a11y: decorative layers hidden', countOf(html, 'aria-hidden="true"') >= 5);
check('a11y: social links carry titles', html.includes('title="LinkedIn"') && html.includes('title="GitHub"'));

console.log('');
if (failed === 0) {
  console.log('ALL LANDING CHECKS PASSED');
} else {
  console.log(`LANDING CHECKS FAILED: ${failed}`);
  process.exitCode = 1;
}

