import { motion, type Variants } from 'framer-motion';
import React from 'react';

/**
 * Shared Framer Motion presets for the landing page.
 * Every reveal uses `once` so the page settles after the first scroll-through.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -34 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.75, ease: EASE } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 34 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.75, ease: EASE } },
};

/** Parent wrapper that staggers its children on scroll into view. */
export const staggerParent = (stagger = 0.09, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const viewportOnce = { once: true, amount: 0.2 } as const;

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}

/** Convenience wrapper: fades + lifts content the first time it scrolls into view. */
export const Reveal: React.FC<RevealProps> = ({ children, className, variants = fadeUp, delay = 0 }) => (
  <motion.div
    className={className}
    variants={variants}
    initial="hidden"
    whileInView="visible"
    viewport={viewportOnce}
    transition={{ delay }}
  >
    {children}
  </motion.div>
);

/** Staggered group: render <RevealItem> children inside. */
export const RevealGroup: React.FC<{ children: React.ReactNode; className?: string; stagger?: number }> = ({
  children,
  className,
  stagger = 0.09,
}) => (
  <motion.div
    className={className}
    variants={staggerParent(stagger)}
    initial="hidden"
    whileInView="visible"
    viewport={viewportOnce}
  >
    {children}
  </motion.div>
);

export const RevealItem: React.FC<{ children: React.ReactNode; className?: string; variants?: Variants }> = ({
  children,
  className,
  variants = fadeUp,
}) => (
  <motion.div className={className} variants={variants}>
    {children}
  </motion.div>
);