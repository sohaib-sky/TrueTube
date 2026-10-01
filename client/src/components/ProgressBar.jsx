import { motion } from 'framer-motion';
import { formatBytes, formatPercent } from '../utils/format.js';
import { cx } from '../utils/cx.js';

/**
 * Progress bar driven by real transferred bytes.
 * When the total size is unknown the bar is indeterminate — it never invents
 * a percentage.
 */
export default function ProgressBar({ ratio = 0, received = 0, total = 0, indeterminate = false, label, className }) {
  const percent = indeterminate ? 0 : Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  const sizeText = total > 0 ? `${formatBytes(received)} of ${formatBytes(total)}` : received > 0 ? formatBytes(received) : '—';

  return (
    <div className={cx('progress', className)}>
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label || 'Download progress'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : percent}
      >
        <motion.div
          className={cx('progress__fill', indeterminate && 'progress__fill--indeterminate')}
          initial={false}
          animate={{ width: indeterminate ? '38%' : `${percent}%` }}
          transition={{ duration: indeterminate ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="progress__meta">
        <span>{label || 'Transferring file'}</span>
        <span>{indeterminate ? sizeText : `${formatPercent(ratio)} · ${sizeText}`}</span>
      </div>    </div>
  );
}
