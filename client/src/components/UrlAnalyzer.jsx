import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, Link2, X } from 'lucide-react';
import Button from './Button.jsx';
import Alert from './Alert.jsx';
import QuickAccess from './QuickAccess.jsx';
import ResultCard from './ResultCard.jsx';
import Skeleton from './Skeleton.jsx';
import { useUrlAnalyzer } from '../hooks/useUrlAnalyzer.js';
import { useTilt } from '../hooks/useTilt.js';
import { buildFormatGroups } from '../utils/formats.js';
import { EASE } from '../animations/variants.js';

function AnalyzingSkeleton() {
  return (
    <motion.div
      className="glass-panel analyzer-feedback"
      aria-hidden="true"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="result__media" style={{ borderBottom: 0 }}>
        <div className="result__thumb">
          <Skeleton height="100%" radius={0} />
        </div>
        <div className="result__body">
          <Skeleton height={24} width="68%" />
          <Skeleton height={12} width="40%" />
          <div className="result__chips" style={{ marginTop: 6 }}>
            <Skeleton height={24} width={92} radius={999} />
            <Skeleton height={24} width={80} radius={999} />
            <Skeleton height={24} width={64} radius={999} />
          </div>
        </div>
      </div>
      <div className="result__section">
        <Skeleton height={11} width={132} />
        <div className="formats__chips" style={{ marginTop: 14 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} height={50} width={index % 2 === 0 ? 104 : 86} radius={16} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** The single source of interaction: paste a URL, analyze, choose, download. */
export default function UrlAnalyzer() {
  const analyzer = useUrlAnalyzer();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (analyzer.status === 'idle') setValue('');
  }, [analyzer.status]);

  const groups = useMemo(() => (analyzer.data ? buildFormatGroups(analyzer.data) : null), [analyzer.data]);
  const mergeAvailable = analyzer.data?.capabilities?.mergeAvailable ?? false;
  const tilt = useTilt({ max: 2.5, scale: 1.004, perspective: 1600 });

  const handleSubmit = (event) => {
    event.preventDefault();
    analyzer.analyze(value);
  };

  return (
    <>
      <form className="glass-panel slab" ref={tilt.ref} {...tilt.tiltProps} onSubmit={handleSubmit} noValidate>
        <div className="slab__row">
          <div className="urlbar" data-invalid={analyzer.validation ? 'true' : undefined}>
            <label className="sr-only" htmlFor="analyzer-input">
              Video URL
            </label>
            <span className="urlbar__icon" aria-hidden="true">
              <Link2 size={19} />
            </span>
            <input
              id="analyzer-input"
              className="glass-input"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck="false"
              placeholder="Paste your video link here..."
              value={value}
              disabled={analyzer.isAnalyzing}
              aria-invalid={analyzer.validation ? 'true' : undefined}
              aria-describedby="analyzer-hint"
              onChange={(event) => setValue(event.target.value)}
            />
            {value ? (
              <button
                type="button"
                className="urlbar__clear"
                onClick={() => {
                  setValue('');
                  document.getElementById('analyzer-input')?.focus();
                }}
                aria-label="Clear the URL field"
              >
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}

            <Button type="submit" variant="primary" className="urlbar__action" loading={analyzer.isAnalyzing}>
              {analyzer.isAnalyzing ? 'Analyzing' : 'Analyze URL'}
            </Button>
          </div>
        </div>

        <QuickAccess />

        <p className="slab__hint" id="analyzer-hint">
          <Info size={13} aria-hidden="true" />
          Supported URLs only. Download content you have permission to use.
        </p>

        <AnimatePresence>
          {analyzer.isAnalyzing ? (
            <motion.p
              className="slab__status"
              key="status"
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="spinner" aria-hidden="true" />
              Contacting the source and reading real metadata…
            </motion.p>
          ) : null}
        </AnimatePresence>
      </form>

      <AnimatePresence>
        {analyzer.status === 'error' && analyzer.error ? (
          <motion.div
            key="error"
            className="analyzer-feedback"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <Alert error={analyzer.error} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>{analyzer.isAnalyzing ? <AnalyzingSkeleton key="skeleton" /> : null}</AnimatePresence>

      {analyzer.status === 'ready' && analyzer.data && groups ? (
        <ResultCard
          data={analyzer.data}
          groups={groups}
          selected={analyzer.selectedFormat}
          onSelect={analyzer.selectFormat}
          download={analyzer.download}
          onDownload={analyzer.startDownload}
          onCancel={analyzer.cancelDownload}
          mergeAvailable={mergeAvailable}
          onReset={analyzer.reset}
        />
      ) : null}
    </>
  );
}
