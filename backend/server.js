const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const https = require('https');
const dotenv = require('dotenv');

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

async function captureScreenshot(page, url) {
  await page.goto(`https://pagespeed.web.dev/?utm_source=psi&utm_medium=redirect&url=${encodeURIComponent(url)}`, {
    waitUntil: 'networkidle2',
    timeout: 120000
  });

  await page.waitForTimeout(3000);
  return page.screenshot({ fullPage: true });
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

app.post('/generate-report', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'URL is required'
    });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const reportData = await analyzeUrl(url);
    const screenshotBuffer = await captureScreenshot(page, url);
    const doc = new PDFDocument({
      margin: 40
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=pagespeed-report.pdf'
    );

    doc.pipe(res);

    doc.fontSize(24).text('Google PageSpeed Insights Report', {
      align: 'center'
    });

    doc.moveDown();

    doc.fontSize(14).text(`Tested URL: ${url}`);
    doc.text(`Analysis Time: ${reportData.analysisTime} seconds`);
    doc.text(`Generated At: ${new Date().toLocaleString()}`);

    doc.moveDown();

    doc.fontSize(18).text('Mobile Scores');

    doc.moveDown(0.5);
    doc.fontSize(14).text(`Performance: ${reportData.mobile.performance}`);
    doc.text(`Accessibility: ${reportData.mobile.accessibility}`);
    doc.text(`Best Practices: ${reportData.mobile.bestPractices}`);
    doc.text(`SEO: ${reportData.mobile.seo}`);

    doc.moveDown();
    doc.fontSize(18).text('Desktop Scores');

    doc.moveDown(0.5);
    doc.fontSize(14).text(`Performance: ${reportData.desktop.performance}`);
    doc.text(`Accessibility: ${reportData.desktop.accessibility}`);
    doc.text(`Best Practices: ${reportData.desktop.bestPractices}`);
    doc.text(`SEO: ${reportData.desktop.seo}`);

    doc.moveDown();
    doc.fontSize(18).text('Result Screenshot');

    doc.moveDown();

    doc.image(screenshotBuffer, {
      fit: [500, 650],
      align: 'center'
    });

    doc.end();

    await browser.close();
  } catch (error) {
    console.error(error);

    if (browser) {
      await browser.close();
    }

    sendError(res, error, 'Failed to generate report');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
