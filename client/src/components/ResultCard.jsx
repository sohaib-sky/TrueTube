import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, ExternalLink, ImageOff, Radio, RotateCcw, X } from 'lucide-react';
import FormatSelector from './FormatSelector.jsx';
import ProgressBar from './ProgressBar.jsx';
import Alert from './Alert.jsx';
import Button from './Button.jsx';
import { formatBytes, formatCount, formatDuration } from '../utils/format.js';
import { EASE } from '../animations/variants.js';

function Thumbnail({ src, title }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="result__thumb-fallback" role="img" aria-label="No thumbnail available">
        <ImageOff size={26} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Thumbnail for ${title}`}
      loading="lazy"
      decoding="async"
      width={320}
      height={180}
      onError={() => setFailed(true)}
    />
  );
}

function MetaRow({ data }) {
  const durationText = data.durationText || formatDuration(data.duration);
  return (
    <div className="result__chips">
      <span className="glass-chip glass-chip--accent">{data.platform}</span>
      {durationText ? <span className="glass-chip">Duration {durationText}</span> : null}
      {data.isLive ? (
        <span className="glass-chip glass-chip--warn">
          <Radio size={12} aria-hidden="true" /> Live
        </span>
      ) : null}
      {data.viewCount ? <span className="glass-chip">{formatCount(data.viewCount)} views</span> : null}
      {data.license ? <span className="glass-chip">{data.license}</span> : null}
      {data.ageLimit >= 18 ? <span className="glass-chip glass-chip--warn">18+</span> : null}
    </div>
  );
}

function DownloadPanel({ data, selected, download, onDownload, onCancel, mergeAvailable }) {
  const { status } = download;

  return (
    <div className="download-bar">
      {status === 'preparing' || status === 'transferring' ? (
        <>
          <ProgressBar
            // While the engine works there are no bytes to count, but the server
            // can report how far along the transfer on the server is. A real
            // number is shown when there is one; otherwise the bar stays
            // indeterminate rather than inventing a figure.
            ratio={
              status === 'preparing' && Number.isFinite(download.stageRatio) && download.stageRatio > 0
                ? download.stageRatio
                : download.ratio
            }
            received={download.received}
            total={download.total}
            indeterminate={
              status === 'preparing'
                ? !(Number.isFinite(download.stageRatio) && download.stageRatio > 0)
                : download.total === 0
            }
            label={
              status === 'preparing'
                ? `${download.stageLabel || 'Starting the download engine'} · ${Math.round((download.elapsedMs || 0) / 1000)}s elapsed`
                : 'Receiving file…'
            }
          />
          <div className="download-bar__row">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X size={15} aria-hidden="true" /> Cancel
            </Button>
            <span className="download-bar__selected">
              {status === 'preparing'
                ? 'The engine is fetching the file on the server. Nothing reaches you until it is complete — this can take a minute on a slow connection.'
                : 'Progress reflects real bytes transferred from the server.'}
            </span>
          </div>
        </>
      ) : null}

      {status === 'done' ? (
        <div className="alert alert--info" role="status">
          <CheckCircle2 className="alert__icon" size={18} aria-hidden="true" />
          <div>
            <p className="alert__title">Download started</p>
            <p className="alert__body">
              {download.fileName} · {formatBytes(download.size)}
            </p>
          </div>
        </div>
      ) : null}

      {status === 'error' && download.error ? <Alert error={download.error} /> : null}

      {status === 'idle' || status === 'error' || status === 'done' ? (
        <div className="download-bar__row">
          <Button variant="primary" onClick={onDownload} disabled={!selected} className="btn--block">
            <Download size={16} aria-hidden="true" />
            {status === 'done' ? 'Download again' : 'Download'}
          </Button>
        </div>
      ) : null}

      <p className="download-bar__selected">
        {selected ? (
          <>
            Selected: <strong>{selected.label}</strong>
            {selected.meta ? <span> · {selected.meta}</span> : null}
            {selected.requiresFfmpeg && !mergeAvailable ? (
              <span className="glass-chip glass-chip--warn" style={{ marginLeft: 8 }}>
                Needs FFmpeg
              </span>
            ) : null}
          </>
        ) : (
          'Select a format above to enable the download.'
        )}
      </p>
      <p className="result__section-note">Source: {data.extractorKey || data.extractor || data.host}</p>
    </div>
  );
}

export default function ResultCard({
  data,
  groups,
  selected,
  onSelect,
  download,
  onDownload,
  onCancel,
  mergeAvailable,
  onReset,
}) {
  return (
    <motion.section
      className="glass-panel result"
      aria-label="Analysis result"
      initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="result__media">
        <div className="result__thumb">
          <Thumbnail src={data.thumbnail} title={data.title} />
        </div>
        <div className="result__body">
          <h3 className="result__title">{data.title}</h3>
          {data.uploader ? (
            <p className="result__uploader">
              <span className="quickaccess__dot" aria-hidden="true" />
              {data.uploader}
            </p>
          ) : null}
          <MetaRow data={data} />
        </div>
      </div>

      <div className="result__section">
        <div className="result__section-head">
          <h4 className="result__section-title">Available formats</h4>
          <span className="result__section-note">
            {groups.total} format{groups.total === 1 ? '' : 's'} reported by the source
          </span>
        </div>
        <FormatSelector groups={groups} selected={selected} onSelect={onSelect} mergeAvailable={mergeAvailable} />
      </div>

      <div className="result__section">
        <DownloadPanel
          data={data}
          selected={selected}
          download={download}
          onDownload={onDownload}
          onCancel={onCancel}
          mergeAvailable={mergeAvailable}
        />
      </div>

      <motion.div
        className="result__section"
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <a className="glass-chip" href={data.webpageUrl} target="_blank" rel="noreferrer noopener">
          <ExternalLink size={12} aria-hidden="true" /> View original page
        </a>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" /> Analyze another link
        </Button>
      </motion.div>
    </motion.section>
  );
}
