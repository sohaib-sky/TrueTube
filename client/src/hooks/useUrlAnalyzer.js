import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeUrl, downloadFormat, saveBlob, ApiError } from '../services/api.js';
import { validateUrlInput } from '../utils/validateUrl.js';

/**
 * Owns the whole URL -> metadata -> download state machine.
 *
 * Every state transition here is driven by a real backend response. There is
 * no timer, no simulation and no placeholder data.
 */
export function useUrlAnalyzer() {
  const [status, setStatus] = useState('idle'); // idle | analyzing | ready | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState(null);

  const [selectedFormat, setSelectedFormat] = useState(null);

  const [download, setDownload] = useState({
    status: 'idle', // idle | preparing | transferring | done | error
    ratio: 0,
    received: 0,
    total: 0,
    fileName: null,
    size: 0,
    error: null,
  });

  const analyzeAbort = useRef(null);
  const downloadAbort = useRef(null);
  const analyzedUrl = useRef(null);

  useEffect(
    () => () => {
      analyzeAbort.current?.abort();
      downloadAbort.current?.abort();
    },
    [],
  );

  const reset = useCallback(() => {
    analyzeAbort.current?.abort();
    downloadAbort.current?.abort();
    analyzedUrl.current = null;
    setStatus('idle');
    setData(null);
    setError(null);
    setValidation(null);
    setSelectedFormat(null);
    setDownload({ status: 'idle', ratio: 0, received: 0, total: 0, fileName: null, size: 0, error: null });
  }, []);

  const analyze = useCallback(async (rawUrl) => {
    const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';

    const check = validateUrlInput(trimmed);
    setValidation(check.valid ? null : check.message);
    if (!check.valid) {
      setStatus('error');
      setError(new ApiError({ code: 'INVALID_URL', message: check.message, status: 0 }));
      setData(null);
      return false;
    }

    analyzeAbort.current?.abort();
    const controller = new AbortController();
    analyzeAbort.current = controller;

    setStatus('analyzing');
    setError(null);
    setData(null);
    setSelectedFormat(null);
    setDownload({ status: 'idle', ratio: 0, received: 0, total: 0, fileName: null, size: 0, error: null });

    try {
      const metadata = await analyzeUrl(check.url, { signal: controller.signal });
      analyzedUrl.current = check.url;
      setData(metadata);
      setStatus('ready');
      return true;
    } catch (caught) {
      if (caught?.name === 'AbortError') return false;
      setError(caught);
      setStatus('error');
      return false;
    }
  }, []);

  const selectFormat = useCallback((format) => {
    setSelectedFormat(format);
    setDownload((current) => ({ ...current, status: 'idle', ratio: 0, received: 0, total: 0, error: null }));
  }, []);

  const cancelDownload = useCallback(() => {
    downloadAbort.current?.abort();
    downloadAbort.current = null;
    setDownload((current) => ({ ...current, status: 'idle', ratio: 0, received: 0, total: 0, error: null }));
  }, []);

  const startDownload = useCallback(async () => {
    const url = analyzedUrl.current;
    if (!url || !selectedFormat) return;

    downloadAbort.current?.abort();
    const controller = new AbortController();
    downloadAbort.current = controller;

    setDownload({ status: 'preparing', ratio: 0, received: 0, total: 0, fileName: null, size: 0, error: null, stage: null, elapsedMs: 0 });

    // The pre-transfer window is real work, so the clock runs through it: an
    // unexplained pause is indistinguishable from a hang.
    const startedAt = Date.now();
    const elapsedTimer = window.setInterval(() => {
      setDownload((current) => (current.status === 'preparing' ? { ...current, elapsedMs: Date.now() - startedAt } : current));
    }, 1000);

    try {
      const result = await downloadFormat({
        url,
        formatId: selectedFormat.id,
        kind: selectedFormat.kind,
        signal: controller.signal,
        onStage: ({ stage, label, note, ratio }) => {
          setDownload((current) =>
            current.status === 'preparing'
              ? { ...current, stage, stageLabel: note || label, stageRatio: ratio ?? null }
              : current,
          );
        },
        onProgress: ({ received, total, ratio }) => {
          setDownload((current) => ({
            ...current,
            status: 'transferring',
            received,
            total,
            ratio,
          }));
        },
      });

      saveBlob(result);

      setDownload({
        status: 'done',
        ratio: 1,
        received: result.size,
        total: result.size,
        fileName: result.fileName,
        size: result.size,
        error: null,
      });
    } catch (caught) {
      if (caught?.name === 'AbortError') {
        setDownload((current) => ({ ...current, status: 'idle', ratio: 0, received: 0, total: 0, error: null }));
        return;
      }
      setDownload((current) => ({ ...current, status: 'error', error: caught, ratio: 0, received: 0, total: 0 }));
    } finally {
      window.clearInterval(elapsedTimer);
    }
  }, [selectedFormat]);

  return {
    status,
    data,
    error,
    validation,
    selectedFormat,
    download,
    analyze,
    reset,
    selectFormat,
    startDownload,
    cancelDownload,
    isAnalyzing: status === 'analyzing',
    isDownloading: download.status === 'preparing' || download.status === 'transferring',
  };
}

export default useUrlAnalyzer;
