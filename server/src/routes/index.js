import { Router } from 'express';
import { health, supported } from '../controllers/healthController.js';
import { analyze, formats, validate } from '../controllers/analyzeController.js';
import { download, status } from '../controllers/downloadController.js';
import { analyzeLimiter, apiLimiter, downloadLimiter, healthLimiter, statusLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/health', healthLimiter, health);
router.get('/supported', apiLimiter, supported);
router.post('/validate', apiLimiter, validate);
router.post('/analyze', analyzeLimiter, analyze);
router.get('/formats', analyzeLimiter, formats);
// Polled while a download is still being prepared. It reports what the engine
// is doing, so it must not be throttled like the transfer itself: the client
// polls every ~1.2s for the whole transfer, which is far more than any general
// API ceiling allows.
router.get('/download/status', statusLimiter, status);
router.post('/download', downloadLimiter, download);

export default router;
