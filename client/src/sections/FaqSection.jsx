import { motion } from 'framer-motion';
import SectionHead from '../components/SectionHead.jsx';
import Faq from '../components/Faq.jsx';
import DeveloperCredit from '../components/DeveloperCredit.jsx';
import { stagger } from '../animations/variants.js';

export default function FaqSection() {
  return (
    <section className="section" id="faq" aria-labelledby="faq-heading">
      <div className="container">
        <SectionHead id="faq" eyebrow="FAQ" title="Questions, answered honestly" center />

        {/* Each question rises in turn, so the list assembles top to bottom
            once the section is on screen. */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger(0.075, 0.05)}
        >
          <Faq />
        </motion.div>

        <DeveloperCredit align="center" />
      </div>
    </section>
  );
}
