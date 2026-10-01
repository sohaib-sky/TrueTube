import { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import WorldBackground from './components/background/WorldBackground.jsx';
import { RouterProvider, useRouter } from './components/Router.jsx';
import HomePage from './pages/HomePage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import {
  PlatformsPage,
  HowItWorksPage,
  FeaturesPage,
  FaqPage,
} from './pages/SectionPages.jsx';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion.js';
import { applyDocumentMeta } from './utils/documentMeta.js';
import { EASE } from './animations/variants.js';

// Every nav entry is its own address rather than an anchor on one long page, so
// a link can be shared, bookmarked and indexed on its own.
const ROUTES = {
  '/': HomePage,
  '/platforms': PlatformsPage,
  '/how': HowItWorksPage,
  '/features': FeaturesPage,
  '/faq': FaqPage,
  '/privacy': PrivacyPage,
  '/terms': TermsPage,
};

function AppShell() {
  const { path } = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const Page = ROUTES[path] || NotFoundPage;

  useEffect(() => {
    document.documentElement.dataset.route = path;
  }, [path]);

  // The server sends a head describing the requested URL. Navigating inside the
  // app changes the URL without a request, so the same values are re-applied
  // here or the tab, the share sheet and the history entry all keep reading the
  // page the visitor came from.
  useEffect(() => {
    applyDocumentMeta(path);
  }, [path]);

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* One continuous 3D world behind every section. If WebGL is missing the
          CSS atmosphere underneath still shows, so there is never a seam. */}
      <ErrorBoundary fallback={null}>
        <WorldBackground reducedMotion={prefersReducedMotion} />
      </ErrorBoundary>

      <Header />

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          id="main"
          key={path}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, filter: 'blur(5px)' }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.34, ease: EASE }}
        >
          <Page />
        </motion.main>
      </AnimatePresence>

      <Footer />
    </MotionConfig>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppShell />
    </RouterProvider>
  );
}
