const button = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
const mobilePerformanceText = document.getElementById('mobilePerformance');
const mobileAccessibilityText = document.getElementById('mobileAccessibility');
const mobileBestPracticesText = document.getElementById('mobileBestPractices');
const mobileSeoText = document.getElementById('mobileSeo');
const desktopPerformanceText = document.getElementById('desktopPerformance');
const desktopAccessibilityText = document.getElementById('desktopAccessibility');
const desktopBestPracticesText = document.getElementById('desktopBestPractices');
const desktopSeoText = document.getElementById('desktopSeo');
const resultMeta = document.getElementById('resultMeta');
const resultUrl = document.getElementById('resultUrl');

const originalButtonText = button.textContent;
const originalDownloadText = downloadBtn.textContent;

function showResultCard(data) {
  mobilePerformanceText.innerText = data.mobile?.performance || 'N/A';
  mobileAccessibilityText.innerText = data.mobile?.accessibility || 'N/A';
  mobileBestPracticesText.innerText = data.mobile?.bestPractices || 'N/A';
  mobileSeoText.innerText = data.mobile?.seo || 'N/A';

  desktopPerformanceText.innerText = data.desktop?.performance || 'N/A';
  desktopAccessibilityText.innerText = data.desktop?.accessibility || 'N/A';
  desktopBestPracticesText.innerText = data.desktop?.bestPractices || 'N/A';
  desktopSeoText.innerText = data.desktop?.seo || 'N/A';

  resultMeta.innerText = `Analysis time: ${data.analysisTime || '-'} sec`;
  resultUrl.innerText = `Analyzed URL: ${data.testedUrl || ''}`;
  resultCard.classList.remove('hidden');
}

button.addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();

  if (!url) {
    alert('Please enter a URL');
    return;
  }

  button.disabled = true;
  downloadBtn.disabled = true;
  button.textContent = 'Analyzing...';
  statusText.className = '';
  statusText.innerText = 'Running PageSpeed analysis. Please wait...';
  resultCard.classList.add('hidden');

  try {
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || 'Failed to analyze URL');
    }

    const data = await response.json();
    showResultCard(data);
    statusText.className = 'success';
    statusText.innerText = 'Analysis complete. View the results below.';
    downloadBtn.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    statusText.className = 'error';
    statusText.innerText = error.message || 'Error generating analysis';
    downloadBtn.classList.add('hidden');
  } finally {
    button.disabled = false;
    button.textContent = originalButtonText;
    downloadBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();

  if (!url) {
    alert('Please enter a URL');
    return;
  }

  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Preparing PDF...';
  statusText.className = '';
  statusText.innerText = 'Generating PDF report. Please wait...';

  try {
    const response = await fetch('http://localhost:5000/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || 'Failed to generate PDF');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'pagespeed-report.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();

    statusText.className = 'success';
    statusText.innerText = 'PDF downloaded successfully!';
  } catch (error) {
    console.error(error);
    statusText.className = 'error';
    statusText.innerText = error.message || 'Error generating PDF';
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = originalDownloadText;
  }
});
