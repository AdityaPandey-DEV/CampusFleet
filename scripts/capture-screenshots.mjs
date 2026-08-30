import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve(process.cwd(), 'docs/screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const pagesToCapture = [
  { url: 'http://localhost:3000', name: 'landing.png', width: 1440, height: 900 },
  { url: 'http://localhost:3000/portal', name: 'student_portal.png', width: 1440, height: 900 },
  { url: 'http://localhost:3000/portal/pass', name: 'digital_pass.png', width: 1440, height: 900 },
  { url: 'http://localhost:3000/portal/tracker', name: 'live_tracker.png', width: 1440, height: 900 },
  { url: 'http://localhost:3000/admin', name: 'admin_dashboard.png', width: 1440, height: 900 },
  { url: 'http://localhost:3000/staff/driver', name: 'driver_console.png', width: 450, height: 850 },
  { url: 'http://localhost:3000/staff/conductor', name: 'conductor_manifest.png', width: 1200, height: 850 },
];

async function main() {
  console.log('Launching browser for screenshots...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const pageInfo of pagesToCapture) {
    console.log(`Capturing ${pageInfo.name} from ${pageInfo.url}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: pageInfo.width, height: pageInfo.height, deviceScaleFactor: 2 });
    await page.goto(pageInfo.url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));
    const filePath = path.join(outDir, pageInfo.name);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`Saved: ${filePath}`);
    await page.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
