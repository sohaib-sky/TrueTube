import Reveal from './Reveal.jsx';

/**
 * The developer credit, in one place.
 *
 * Every section renders this rather than repeating the markup, so the wording,
 * the styling, the spacing and the animation cannot drift apart between pages.
 * The text is fixed by design — it is a signature, not content — and it is
 * exported so a test can assert on it without scraping the DOM.
 */
export const DEVELOPER_CREDIT = 'Developed by';

/**
 * One component for every section, plus the footer's own placement.
 *
 * The emphasis on "TrueLife Academy" is carried by weight and a brighter ink
 * rather than by size or glow: at this size, a glow would smear into the
 * animated background behind it rather than read as emphasis.
 *
 * `as` keeps the element semantic — a `<p>` inside a section, which is what it
 * is — while the class carries the variant.
 */
export default function DeveloperCredit({
  variant = 'section',
  className = '',
  delay = 0,
  y = 14,
  align = 'start',
}) {
  return (
    <Reveal
      as="p"
      className={`credit credit--${variant} credit--${align} ${className}`.trim()}
      // The credit is the last thing in a section, so it reveals last and with
      // the shortest travel of anything on the page. It should be noticed, not
      // waited for.
      y={y}
      delay={delay}
      spring="snappy"
      amount={0.4}
    >
      <span className="credit__lead">{DEVELOPER_CREDIT}</span>{' '}
      <span className="credit__name">TrueLife Academy</span>{' '}
      <span className="credit__year">&copy; 2026</span>
    </Reveal>
  );
}
