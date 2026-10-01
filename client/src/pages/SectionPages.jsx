// Platform tools, how it works, features and FAQ each get their own page.
import Platforms from '../sections/Platforms.jsx';
import HowItWorks from '../sections/HowItWorks.jsx';
import Features from '../sections/Features.jsx';
import FaqSection from '../sections/FaqSection.jsx';

export function PlatformsPage() {
  return <Platforms />;
}

export function HowItWorksPage() {
  return <HowItWorks />;
}

export function FeaturesPage() {
  return <Features />;
}

export function FaqPage() {
  return <FaqSection />;
}
