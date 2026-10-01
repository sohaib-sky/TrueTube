import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, PlayCircle, Zap } from 'lucide-react';
import UrlAnalyzer from '../components/UrlAnalyzer.jsx';
import DeveloperCredit from '../components/DeveloperCredit.jsx';
import { Link } from '../components/Router.jsx';
import HeroOrb from '../components/HeroOrb.jsx';
import Button from '../components/Button.jsx';
import { focusAnalyzer } from '../components/Header.jsx';
import { useSupportedSources } from '../hooks/useSupportedSources.js';
import { fadeUp, maskedLine, maskedLinePlain, popIn, riseIn, SPRING, SPRING_SOFT } from '../animations/variants.js';

/**
 * One masked line of the headline. The clip wrapper hides the text until the
 * spring has carried it up into view, so the words physically travel rather
 * than cross-fade.
 */
function HeadlineLine({ children, delay = 0, className, plain = false }) {
  return (
    <span className="hero__line">
      <motion.span
        className={className}
        initial="hidden"
        animate="visible"
        variants={plain ? maskedLinePlain : maskedLine}
        transition={{ delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export default function Hero() {
  const reduced = useReducedMotion();
  const container = reduced
    ? undefined
    : { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } };
  const { data } = useSupportedSources();
  const platformCount = data?.platforms?.length ?? null;
  const sub = <em>{platformCount ? `from ${platformCount}+ Platforms` : 'from Any Platform'}</em>;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container">
        <div className="hero__grid">
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.span className="hero__eyebrow" variants={popIn}>
              <Zap size={13} aria-hidden="true" />
              Fast • Free • No Registration
            </motion.span>

            {/* The two headline lines run on their own springs with a short
                offset, so the second line arrives after the first has settled. */}
            <h1 className="hero__title" id="hero-title">
              {reduced ? (
                <>
                  Download Videos
                  <br />
                  {sub}
                </>
              ) : (
                <>
                  <HeadlineLine delay={0.05}>Download Videos</HeadlineLine>
                  <HeadlineLine className="hero__title-accent" delay={0.16} plain>
                    {sub}
                  </HeadlineLine>
                </>
              )}
            </h1>

            <motion.p className="hero__subtitle" variants={fadeUp}>
              Save the media you are allowed to download from YouTube, TikTok, Facebook and more supported platforms.
              Simple, fast, and honest.
            </motion.p>

            <motion.div className="hero__ctas" variants={fadeUp}>
              <Button variant="primary" onClick={focusAnalyzer}>
                <ArrowRight size={16} aria-hidden="true" />
                Start Downloading
              </Button>
              <Link to="/how">
                <Button variant="ghost">
                  <PlayCircle size={16} aria-hidden="true" />
                  Watch How It Works
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="hero__stage"
            initial="hidden"
            animate="visible"
            variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : riseIn}
            transition={{ ...SPRING_SOFT, delay: 0.12 }}
          >
            <HeroOrb />
          </motion.div>
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : riseIn}
          transition={{ ...SPRING, delay: 0.3 }}
        >
          <UrlAnalyzer />
        </motion.div>

        <DeveloperCredit align="center" />
      </div>
    </section>
  );
}
