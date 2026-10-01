import { Play } from 'lucide-react';
import { Link } from './Router.jsx';

/** TrueTube wordmark: glossy product mark + two-tone wordmark + tagline. */
export default function Logo({ tagline = 'Modern media utility', onClick, compact = false }) {
  return (
    <Link to="/" className="logo" onClick={onClick} aria-label="TrueTube — home">
      <span className="logo__mark" aria-hidden="true">
        <Play size={compact ? 15 : 17} fill="currentColor" strokeWidth={0} />
      </span>
      <span className="logo__words">
        <span className="logo__word" aria-hidden="true">
          <span>True</span>
          <span>Tube</span>
        </span>
        <span className="logo__tagline" aria-hidden="true">
          {tagline}
        </span>
      </span>
    </Link>
  );
}
