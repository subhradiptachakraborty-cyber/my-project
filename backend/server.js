const express = require('express');
const cors = require('cors');
const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY;

class ApiError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 120000 }, (res) => {
      let raw = '';

      res.on('data', (chunk) => {
        raw += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          let details = raw;

          try {
            details = JSON.parse(raw);
          } catch {
            details = raw;
          }

          return reject(new ApiError(`PSI API returned ${res.statusCode}`, res.statusCode, details));
        }

        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('PSI request timed out'));
    });
  });
}

function formatScore(score) {
  if (typeof score !== 'number') {
    return 'N/A';
  }
  return `${Math.round(score * 100)}`;
}

function buildScores(result) {
  const categories = result?.lighthouseResult?.categories || {};

  return {
    performance: formatScore(categories.performance?.score),
    accessibility: formatScore(categories.accessibility?.score),
    bestPractices: formatScore(categories['best-practices']?.score),
    seo: formatScore(categories.seo?.score)
  };
}

function isQuotaError(error) {
  return (
    error?.statusCode === 429 ||
    String(error?.message).toLowerCase().includes('quota') ||
    String(error?.details?.error?.status).toLowerCase() === 'resource_exhausted'
  );
}

function sendError(res, error, defaultMessage) {
  const quotaExceeded = isQuotaError(error);
  const status = quotaExceeded ? 503 : 500;
  const message = quotaExceeded
    ? 'PageSpeed API quota exceeded. Set PAGESPEED_API_KEY in backend/.env or use a different Google Cloud project.'
    : defaultMessage;

  res.status(status).json({
    error: message,
    details: error.details || error.message
  });
}

async function getPsiScores(url, strategy) {
  const apiKeyParam = PAGESPEED_API_KEY ? `&key=${encodeURIComponent(PAGESPEED_API_KEY)}` : '';
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}${apiKeyParam}`;
  const json = await fetchJson(apiUrl);
  return buildScores(json);
}

async function analyzeUrl(url) {
  const startTime = Date.now();

  const [mobile, desktop] = await Promise.all([
    getPsiScores(url, 'mobile'),
    getPsiScores(url, 'desktop')
  ]);

  return {
    testedUrl: url,
    analysisTime: ((Date.now() - startTime) / 1000).toFixed(2),
    mobile,
    desktop
  };
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/analyze', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'URL is required'
    });
  }

  try {
    const reportData = await analyzeUrl(url);
    res.json(reportData);
  } catch (error) {
    console.error(error);
    sendError(res, error, 'Failed to analyze URL');
  }
});

// Fallback to index.html for client-side routing (must be AFTER all API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
