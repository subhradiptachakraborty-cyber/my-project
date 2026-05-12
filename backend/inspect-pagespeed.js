const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('https://pagespeed.web.dev/?utm_source=psi&utm_medium=redirect&url=http://example.com', {waitUntil:'networkidle2'});
  await page.waitForTimeout(15000);
  const content = await page.evaluate(() => {
    const lines = [];
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
    lines.push(`BUTTONS:${JSON.stringify(buttons)}`);
    const aria = Array.from(document.querySelectorAll('[aria-label]')).map(el => ({label: el.getAttribute('aria-label'), text: el.innerText.trim().slice(0,120)}));
    lines.push(`ARIA:${JSON.stringify(aria.slice(0,80))}`);
    const charts = Array.from(document.querySelectorAll('.lh-gauge__percentage, [role="tab"], h2, .lh-scores__percentage, .lh-breakdown__score')).map(el=>({tag:el.tagName, role:el.getAttribute('role'), text:el.innerText.trim().slice(0,120), aria:el.getAttribute('aria-label')}));
    lines.push(`CHARTS:${JSON.stringify(charts.slice(0,120))}`);
    const desktopTab = document.querySelector('button[aria-label*="Desktop"]') || document.querySelector('button[role="tab"]');
    lines.push(`DESKTOPTAB:${desktopTab ? desktopTab.innerText.trim() : 'NONE'}`);
    return lines.join('\n');
  });
  console.log(content);
  await browser.close();
})();
