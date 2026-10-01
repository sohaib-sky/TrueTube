import { motion } from 'framer-motion';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { cx } from '../utils/cx.js';
import { describeError } from '../utils/errorMessages.js';

const ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ROLE = { error: 'alert', warning: 'status', info: 'status' };

const normalise = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Would the hint only repeat the message?
 *
 * The server message and the local hint are written independently, so for some
 * codes they land on the same sentence — which showed up as the same paragraph
 * printed twice inside one alert. Measured as word overlap rather than string
 * equality so small rewording still counts as a duplicate.
 */
function isRedundant(message, hint) {
  const a = normalise(message);
  const b = normalise(hint);
  if (!a || !b) return false;
  if (a === b) return true;

  const words = b.split(' ').filter((word) => word.length > 3);
  if (words.length < 3) return false;
  const shared = words.filter((word) => a.includes(word)).length;
  return shared / words.length > 0.6;
}

/**
 * Polished error surface. The backend message is shown verbatim; the title and
 * hint add context from the local error catalog — unless the hint would only
 * say the same thing again.
 */
export default function Alert({ variant = 'error', error, title, message, hint, showCode = true, className, children }) {
  const described = error ? describeError(error) : null;
  const Icon = ICONS[variant] || ICONS.error;

  const resolvedTitle = title ?? described?.title ?? 'Something needs attention';
  const resolvedMessage = message ?? described?.message ?? 'Please verify the link and try again.';
  const candidateHint = hint ?? described?.hint ?? null;
  const resolvedHint = isRedundant(resolvedMessage, candidateHint) ? null : candidateHint;
  const code = error?.code ?? null;

  return (
    <motion.div
      className={cx('alert', `alert--${variant}`, className)}
      role={ROLE[variant]}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Icon className="alert__icon" size={18} aria-hidden="true" />
      <div>
        <p className="alert__title">{resolvedTitle}</p>
        <p className="alert__body">{resolvedMessage}</p>
        {resolvedHint ? <p className="alert__body">{resolvedHint}</p> : null}
        {children}
        {showCode && code ? <span className="alert__code">code: {code}</span> : null}
      </div>
    </motion.div>
  );
}
