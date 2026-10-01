import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Logo from './Logo.jsx';
import Button from './Button.jsx';
import { Link, useRouter } from './Router.jsx';
import { useScrolled } from '../hooks/useScrolled.js';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll.js';
import { useHideOnScroll } from '../hooks/useHideOnScroll.js';
import { EASE, SPRING, SPRING_SNAPPY, SPRING_SOFT } from '../animations/variants.js';

/**
 * The retract spring. Fast enough to feel like the banner got out of the way,
 * damped enough that it settles rather than snapping.
 */
const RETRACT_SPRING = { type: 'spring', stiffness: 320, damping: 34, mass: 0.7 };

/**
 * The banner settles onto the page on a soft spring, arriving from slightly
 * above and slightly blurred, so the first thing a visitor sees is the glass
 * slab assembling itself out of the world.
 */
const bannerVariants = {
  hidden: { opacity: 0, y: -28, scale: 0.97, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { ...SPRING_SOFT, delay: 0.05 },
  },
};

/**
 * Real addresses, not anchors on one long page.
 *
 * Each entry used to be `/#platforms`, which scrolled within the home page. That
 * made the links unshareable and unbookmarkable, left every page with the same
 * URL, and meant a visitor who landed on "Supported" had no address to send to
 * anyone else.
 */
const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Supported', to: '/platforms' },
  { label: 'How It Works', to: '/how' },
  { label: 'Features', to: '/features' },
  { label: 'FAQ', to: '/faq' },
];

/**
 * One navigation link.
 *
 * The active indicator is a single shared element (layoutId) that physically
 * slides between links instead of blinking on and off, and each label lifts a
 * little and gains a glow on hover.
 */
function NavItem({ link, isActive, reduced }) {
  return (
    <Link
      to={link.to}
      className="nav__link"
      aria-current={isActive ? 'page' : undefined}
    >
      <motion.span
        className="nav__label"
        whileHover={reduced ? undefined : { y: -1.5 }}
        transition={SPRING_SNAPPY}
      >
        {link.label}
      </motion.span>

      {/* The active marker is one shared element (layoutId) that physically
          travels between links rather than blinking on and off. */}
      {isActive ? (
        <motion.span
          className="nav__indicator"
          layoutId="nav-indicator"
          transition={SPRING}
          aria-hidden="true"
        />
      ) : null}

      <motion.span
        className="nav__underline"
        initial={false}
        whileHover={reduced ? undefined : { scaleX: 1, opacity: 1 }}
        transition={SPRING_SNAPPY}
        aria-hidden="true"
      />
    </Link>
  );
}

/** Scrolls to the analyzer and focuses the field — used by every "paste" CTA. */
export function focusAnalyzer() {
  const field = document.getElementById('analyzer-input');
  if (!field) return;
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => field.focus({ preventScroll: true }), 320);
}

export default function Header() {
  const scrolled = useScrolled(16);
  const [open, setOpen] = useState(false);
  const { path } = useRouter();
  const toggleRef = useRef(null);
  const reduced = useReducedMotion();
  // Each section is its own address now, so the current entry is simply the
  // current path. The scroll-spy that used to track which section was on screen
  // had nothing left to observe and would have highlighted nothing at all.
  // The banner belongs to the top of the document: it shows there and retracts
  // as soon as the reader scrolls into the page. It stays pinned open while the
  // mobile sheet is open, so the close control can never slide out from under
  // the reader's thumb.
  const hidden = useHideOnScroll({ disabled: reduced || open });

  // Banner parallax. Raw pointer position is stored in motion values and
  // spring-damped on the way to the transform, so the slab always glides.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const hover = useMotionValue(0);
  const tiltY = useSpring(useTransform(px, [-0.5, 0.5], [-2.4, 2.4]), { stiffness: 120, damping: 20 });
  const tiltX = useSpring(useTransform(py, [-0.5, 0.5], [1.6, -1.6]), { stiffness: 120, damping: 20 });
  const lift = useSpring(useTransform(hover, [0, 1], [0, -3]), { stiffness: 160, damping: 22 });

  // The retract. Declarative rather than a pair of hand-driven springs: a
  // percentage-valued spring MotionValue never made it into the inline
  // transform, and the banner simply sat there. Animate on the element itself
  // is the same path the rest of the page's motion already uses.
  //
  // The banner stays `position: fixed` and is only translated, so nothing in
  // the document flow changes and the page never jumps as it moves.
  const retract = hidden
    ? { y: '-105%', opacity: 0 }
    : { y: '0%', opacity: 1 };

  const onBannerMove = useCallback(
    (event) => {
      if (reduced || event.pointerType === 'touch') return;
      const rect = event.currentTarget.getBoundingClientRect();
      px.set((event.clientX - rect.left) / rect.width - 0.5);
      py.set((event.clientY - rect.top) / rect.height - 0.5);
      hover.set(1);
    },
    [hover, px, py, reduced],
  );

  const onBannerLeave = useCallback(() => {
    px.set(0);
    py.set(0);
    hover.set(0);
  }, [hover, px, py]);

  useLockBodyScroll(open);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      {/* Three separate elements, three separate transforms: this one owns the
          scroll retract, the one below owns the entrance, and the innermost
          owns the pointer parallax. Motion composes one transform per element,
          so stacking them on a single node would mean one silently winning. */}
      <motion.header
        className="header"
        animate={reduced ? { y: '0%', opacity: 1 } : retract}
        transition={RETRACT_SPRING}
        data-hidden={hidden ? 'true' : undefined}
      >
        <motion.div
          className="header__enter"
          initial="hidden"
          animate="visible"
          variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : bannerVariants}
        >
          <motion.div
            className="container header__inner"
            style={reduced ? undefined : { rotateX: tiltX, rotateY: tiltY, y: lift }}
            onPointerMove={onBannerMove}
            onPointerLeave={onBannerLeave}
          >
          <div className="header__logo">
            <Logo onClick={() => setOpen(false)} />
          </div>

          <nav className="nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavItem
                key={link.label}
                link={link}
                reduced={reduced}
                isActive={link.to === path}
              />
            ))}
          </nav>

          <div className="header__actions">
            {/* The primary action was removed: the analyzer is the entire home
                page, so a banner button that only scrolled or re-navigated to
                the page you were already on was dead weight competing with the
                nav for attention. */}
            <Button
              ref={toggleRef}
              className="btn--icon nav-toggle"
              size="sm"
              variant="ghost"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </Button>
          </div>
          </motion.div>
        </motion.div>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <div className="container">
              <ul className="mobile-nav__list">
                {NAV_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} onClick={() => setOpen(false)}>
                      <span className="mobile-nav__link">{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
