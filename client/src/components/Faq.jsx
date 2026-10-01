import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SPRING, SPRING_SOFT, SPRING_SNAPPY, controlTap, fadeUp } from '../animations/variants.js';

const FAQ_ITEMS = [
  {
    question: 'What is TrueTube?',
    answer:
      'TrueTube is a self-hosted web utility for processing supported video URLs. It runs yt-dlp on the server, returns the real metadata and format list for a link, and streams the format you choose back to your browser.',
  },
  {
    question: 'How does URL analysis work?',
    answer:
      'Your browser validates the link, then sends it to the TrueTube API. The server re-validates it against an allowlist, resolves the hostname to confirm it is a public address, and runs yt-dlp with a locked-down configuration. Whatever the source reports is what you see — nothing is cached in the page or filled in by the browser.',
  },
  {
    question: 'Why is a URL unsupported?',
    answer:
      'A link is refused when its hostname is not on the server allowlist, when the installed yt-dlp build has no extractor for it, or when the source returns no downloadable formats. A hostname being listed only means TrueTube will attempt the link; the outcome always comes from the real request.',
  },
  {
    question: 'Can I download private videos?',
    answer:
      'No. TrueTube never sends cookies, credentials or netrc data, and it refuses private, unlisted, members-only, sign-in-gated, age-restricted and DRM-protected media. Those requests return an explicit error such as PRIVATE_CONTENT or AUTH_REQUIRED.',
  },
  {
    question: 'What formats are available?',
    answer:
      'Exactly the ones the source reports for that specific media. You will see video options labelled by resolution and audio-only options with their bitrate, plus size and codec details when the source provides them. Video-only streams that need the best audio track merged in are marked MERGE and require FFmpeg on the server.',
  },
  {
    question: 'Why did a download fail?',
    answer:
      'Common causes are a removed or renamed video, a source rate limit, a format that is no longer offered, a timeout, or a missing FFmpeg installation for formats that merge streams. The interface shows the real error code from the server so you can tell which one occurred, and nothing is retried silently.',
  },
  {
    question: 'Does TrueTube store downloaded files?',
    answer:
      'No. Each download runs in its own temporary directory. The file is streamed to you and the directory is deleted immediately afterwards — including on failure, timeout or if you cancel. A background sweeper also removes anything left behind by an interrupted process, and nothing is kept beyond that.',
  },
];

function FaqItem({ item, isOpen, onToggle, index }) {
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;

  return (
    <motion.div
      className="faq__item"
      data-open={isOpen}
      layout
      variants={fadeUp}
      transition={SPRING_SOFT}
      whileHover={{ x: 5 }}
    >
      <h3 style={{ margin: 0 }}>
        <motion.button
          type="button"
          id={buttonId}
          className="faq__trigger"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          whileTap={controlTap}
          transition={SPRING_SNAPPY}
        >
          {item.question}
          <motion.span
            className="faq__chevron"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={SPRING}
          >
            <ChevronDown size={18} aria-hidden="true" />
          </motion.span>
        </motion.button>
      </h3>

      {/* Spring height expansion with a small y travel and a fading answer, so
          the panel is never swapped in with display:none. */}
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="panel"
            id={panelId}
            className="faq__panel"
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ ...SPRING, opacity: { duration: 0.22 } }}
          >
            <motion.p
              className="faq__answer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.06 }}
            >
              {item.answer}
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="faq">
      {FAQ_ITEMS.map((item, index) => (
        <FaqItem
          key={item.question}
          item={item}
          index={index}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
        />
      ))}
    </div>
  );
}
