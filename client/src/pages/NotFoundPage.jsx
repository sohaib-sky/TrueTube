import Button from '../components/Button.jsx';
import { Link } from '../components/Router.jsx';

export default function NotFoundPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="notfound">
          <p className="notfound__code" aria-hidden="true">
            404
          </p>
          <h1 className="page__title">This page does not exist</h1>
          <p className="page__lead" style={{ margin: '0 auto' }}>
            The link you followed is not part of TrueTube. Head back to the analyzer and paste a supported video URL.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/">
              <Button variant="primary">Back to home</Button>
            </Link>
            <Link to="/faq">
              <Button variant="ghost">Read the FAQ</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
