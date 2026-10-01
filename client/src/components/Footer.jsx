import { motion } from 'framer-motion';
import Logo from './Logo.jsx';
import DeveloperCredit from './DeveloperCredit.jsx';
import { Link } from './Router.jsx';
import { fadeUp, stagger, SPRING_SNAPPY } from '../animations/variants.js';

const LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'FAQ', to: '/#faq' },
  { label: 'Engine status', href: '/api/health' },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        {/* The footer rises as one surface, with its links cascading after it. */}
        <motion.div
          className="footer__bar"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger(0.07, 0.04)}
        >
          <motion.div variants={fadeUp}>
            <Logo compact tagline="Supported video downloader" />
          </motion.div>

          <motion.nav aria-label="Footer" variants={fadeUp}>
            <motion.ul
              className="footer__links"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={stagger(0.06, 0.05)}
            >
              {LINKS.map((link) => (
                <motion.li key={link.label} variants={fadeUp}>
                  {link.href ? (
                    <a href={link.href} target="_blank" rel="noreferrer noopener">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.to}>{link.label}</Link>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          </motion.nav>
        </motion.div>

        {/* The signature is its own band with its own divider, so it reads as a
            colophon rather than as another line of footer text. */}
        <div className="footer__signature">
          <DeveloperCredit variant="footer" align="center" delay={0.06} />
        </div>

        <motion.p
          className="footer__legal"
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.6 }}
          transition={SPRING_SNAPPY}
        >
          © {new Date().getFullYear()} TrueTube. Download only content you have permission to download and that the
          source platform allows you to download. Media is processed transiently and never stored permanently.
        </motion.p>
      </div>
    </footer>
  );
}
