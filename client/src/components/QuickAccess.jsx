import { MoreHorizontal } from 'lucide-react';
import { Link } from './Router.jsx';
import { useSupportedSources } from '../hooks/useSupportedSources.js';

const MAX_CHIPS = 5;

/**
 * "Quick access" strip inside the downloader slab. Rendered from the live
 * allowlist, so it can never advertise a host the backend would reject.
 * These are informational, not actions: there is no URL to pre-fill.
 */
export default function QuickAccess() {
  const { status, data } = useSupportedSources();

  if (status !== 'ready' || !data?.platforms?.length) return null;

  const chips = data.platforms.slice(0, MAX_CHIPS);
  const remaining = data.platforms.length - chips.length;

  return (
    <div className="quickaccess">
      <span className="quickaccess__label">Quick Access:</span>
      {chips.map((entry) => (
        <span className="quickaccess__item" key={entry.platform}>
          <span className="quickaccess__dot" aria-hidden="true" />
          {entry.platform}
        </span>
      ))}
      {remaining > 0 ? (
        <Link className="quickaccess__item" to="/#platforms">
          <MoreHorizontal size={14} aria-hidden="true" />
          {`+${remaining} more`}
        </Link>
      ) : null}
    </div>
  );
}
