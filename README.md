# PageSpeed PDF Generator

## Features
- Enter website URL
- Automatically opens PageSpeed Insights
- Clicks Analyze
- Waits for report generation
- Measures analysis time
- Exports results into PDF
- Includes screenshot in PDF

---

## Installation

### 1. Open Terminal

### 2. Go to backend folder

```bash
cd backend
```

### 3. Install packages

```bash
npm install
```

### 4. Start server

```bash
npm start
```

Server will run on:

```bash
http://localhost:5000
```

### Optional: Use a Google PageSpeed API key
To avoid quota issues from the shared default project, add your own key to `backend/.env`:

```bash
PAGESPEED_API_KEY=YOUR_GOOGLE_API_KEY
```

If you do not set an API key, the app will still run but may fail when the Google PageSpeed quota is exhausted.

---

## Run Frontend

Open:

```bash
frontend/index.html
```

in your browser.

---

## Notes

- Uses Puppeteer browser automation
- Uses Google PageSpeed Insights
- Generates downloadable PDF report
- Wait time depends on website speed
