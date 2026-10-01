import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

function normalise(pathname) {
  if (!pathname) return '/';
  const clean = pathname.replace(/\/+$/, '');
  return clean === '' ? '/' : clean;
}

function currentPath() {
  if (typeof window === 'undefined') return '/';
  return normalise(window.location.pathname);
}

function scrollToHash(hash) {
  if (!hash) return false;
  const target = document.getElementById(hash);
  if (!target) return false;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  return true;
}

/** Minimal history-API router: enough for a small site, zero dependencies. */
export function RouterProvider({ children }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const [pathname, hash] = String(to).split('#');
    const target = normalise(pathname);
    const url = `${target}${hash ? `#${hash}` : ''}`;

    if (replace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);

    setPath(target);

    if (hash) {
      // Wait a frame so a freshly mounted section exists before scrolling.
      window.requestAnimationFrame(() => scrollToHash(hash));
    } else if (target !== currentPath()) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      window.requestAnimationFrame(() => scrollToHash(window.location.hash.slice(1)));
    }
  }, [path]);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used inside <RouterProvider>');
  return context;
}

/** Anchor-based client link: real <a href>, intercepts unmodified clicks only. */
export function Link({ to, children, onClick, ...rest }) {
  const { navigate } = useRouter();

  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
