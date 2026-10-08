import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Scale,
  ShieldCheck,
  Sparkles,
  Lock,
  ArrowLeft,
  Award,
  Contrast,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { THEME_MODES, useThemeStore, type ThemeMode } from '../stores/themeStore';

let authTransitionTimeout: number | undefined;

export const startAuthPageTransition = (direction: 'forward' | 'backward') => {
  if (!('startViewTransition' in document)) return;

  const root = document.documentElement;
  root.classList.remove('auth-view-forward', 'auth-view-backward');
  root.classList.add(direction === 'forward' ? 'auth-view-forward' : 'auth-view-backward');
  window.clearTimeout(authTransitionTimeout);
  authTransitionTimeout = window.setTimeout(() => {
    root.classList.remove('auth-view-forward', 'auth-view-backward');
  }, 600);
};

/**
 * Shared shell for the authentication pages (sign in / sign up).
 *
 * One presentation for both pages: a split card floating over a blurred brand
 * wash — a light "paper" half holding the form and a navy half carrying the
 * logo, the promise and the feature list. Sign in puts the brand half on the
 * left (form on the right), sign up mirrors it, so the pair reads as the same
 * surface seen from two angles. Both pages share the animated panel swap.
 *
 * Theme note: the brand half uses `--brand-panel`, a dark navy gradient in all
 * three themes, so its copy is pinned to white in CSS. The form half is always
 * the light surface, and re-declares the theme tokens locally (see index.css).
 */

const TRUST_POINTS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Sparkles,
    title: 'AI-assisted intake',
    description: 'Client matters are analysed and routed to the right practice area in seconds.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based confidentiality',
    description: 'Four permission tiers keep privileged material limited to the right people.',
  },
  {
    icon: Lock,
    title: 'Auditable by design',
    description: 'Every case, document and message is tracked for compliance review.',
  },
];

/** Icon shown for each theme in the floating chrome switch. */
const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  normal: Contrast,
  dark: Moon,
  light: Sun,
};

/**
 * Floating theme picker over the backdrop. The three options mirror the labels
 * used by Settings so the same wording (and aria-labels) work in both places.
 */
const ThemeSwitch: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="auth-theme-switch" role="group" aria-label="Colour theme">
      {THEME_MODES.map(mode => {
        const Icon = THEME_ICONS[mode.value];
        const active = mode.value === theme;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => setTheme(mode.value)}
            className={`auth-theme-option${active ? ' is-active' : ''}`}
            aria-pressed={active}
            aria-label={`${mode.label} theme`}
            title={mode.description}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
};

/**
 * Navy half of the card: crest, brand name, promise and the feature list.
 * Order utilities place it on either side of the card (see `brandSide`).
 */
const BrandPanel: React.FC<{ className?: string }> = ({ className = '' }) => (
  <aside className={`auth-brand p-7 sm:p-9 lg:p-10 ${className}`}>
    <div className="my-auto w-full max-w-[20rem] mx-auto text-center">
      <span className="auth-brand-logo">
        <Scale size={28} />
      </span>
      <span className="auth-brand-eyebrow block mt-6">Legal practice platform</span>
      <h2 className="auth-brand-title">JurisFlow</h2>
      <p className="auth-brand-subtitle">Client intake, matters and AI analysis in one workspace</p>
      <p className="auth-brand-copy hidden sm:block">
        Follow every matter, share documents with counsel and keep the deadlines in view — inside
        one confidential, audited environment.
      </p>

      {/* Wrapper carries the responsive hiding so the list keeps its own display */}
      <div className="mt-8 hidden lg:block">
        <ul className="auth-brand-feature-list text-left">
          {TRUST_POINTS.map(point => (
            <li key={point.title} className="auth-brand-feature">
              <span className="auth-brand-icon">
                <point.icon size={16} />
              </span>
              <span>
                <span className="auth-brand-feature-title">{point.title}</span>
                <span className="auth-brand-feature-desc">{point.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>

    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="auth-brand-chip">
        <Award size={12} />
        Trusted by 200+ firms
      </span>
      <span className="auth-brand-chip">
        <Lock size={12} />
        Encrypted · Bar-compliant
      </span>
    </div>
  </aside>
);

export interface AuthLayoutProps {
  /** Small label above the title, e.g. "Client portal". */
  badge: string;
  title: string;
  subtitle: string;
  /** Direction of the entrance animation, mirroring the login <-> signup swap. */
  direction?: 'left' | 'right';
  /** Which half of the card the navy brand panel occupies. Defaults to `right`. */
  brandSide?: 'left' | 'right';
  /** Link back to the other auth page, rendered under the form. */
  footer: React.ReactNode;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  badge,
  title,
  subtitle,
  direction = 'left',
  brandSide = 'right',
  footer,
  children,
}) => {
  const location = useLocation();
  const arrivedWithTransition = Boolean(
    (location.state as { authPageTransition?: boolean } | null)?.authPageTransition,
  );
  const panelAnimation = arrivedWithTransition
    ? ''
    : direction === 'right'
      ? 'animate-auth-in-right'
      : 'animate-auth-in-left';
  // The whole screen travels as well, in the same direction as the card: sign in
  // arrives from the left, sign up from the right (see index.css).
  const pageAnimation = arrivedWithTransition
    ? ''
    : direction === 'right'
      ? 'animate-auth-page-right'
      : 'animate-auth-page-left';
  // The DOM keeps the brand half first (it is the banner on small screens), so
  // sign up only has to swap the halves from the `lg` breakpoint up — sign in
  // already reads brand-left / form-right.
  const brandOrder = brandSide === 'right' ? 'lg:order-2' : 'lg:order-1';
  const formOrder = brandSide === 'right' ? 'lg:order-1' : 'lg:order-2';

  return (
    /* The wrapper clips the sideways travel (and only the travel), so the slide
       never adds a horizontal scrollbar. */
    <div className={`auth-page${pageAnimation ? ` ${pageAnimation}` : ''}`}>
      <div className="min-h-screen relative overflow-hidden flex flex-col">
        {/* Blurred brand wash behind the card */}
        <div className="auth-backdrop" aria-hidden="true" />

        <div className="relative z-10 flex flex-1 flex-col">
          {/* Floating chrome: escape route on the left, theme switch on the right */}
          <header className="flex items-center justify-between px-4 sm:px-7 py-5">
            <Link to="/" className="auth-chrome-btn" aria-label="Back to home" title="Back to home">
              <ArrowLeft size={17} />
            </Link>
            <ThemeSwitch />
          </header>

          <main className="flex flex-1 items-center justify-center px-4 pb-8 sm:px-7 sm:pb-10">
            <div className="w-full max-w-[60rem]">
              {/* key={title} restarts the entrance animation on login <-> signup swaps */}
              <div key={title} className={panelAnimation || undefined}>
                <div className="auth-card grid lg:grid-cols-2 lg:min-h-[34rem]">
                  <BrandPanel className={brandOrder} />

                  <div className={`auth-form ${formOrder} p-6 sm:p-8 lg:p-9`}>
                    <header>
                      <span className="auth-form-eyebrow">{badge}</span>
                      <h1 className="auth-form-title">{title}</h1>
                      <p className="auth-form-subtitle">{subtitle}</p>
                    </header>

                    <div className="mt-7 flex-1">{children}</div>

                    <div className="auth-form-foot">{footer}</div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

