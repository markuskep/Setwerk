/* Intercept Google requests: this check never sends analytics test data to Google. */
const {chromium} = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '../Setwerk-Webapp-1.2.0-Projektdateien/dist');
const screenshots = path.join(process.env.RUNNER_TEMP || require('node:os').tmpdir(), 'setwerk-ui');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'};
const mock = `export async function getUser(){return null;}export async function subscribeAuth(fn){fn(null);}export async function signup(){}export async function login(){}export async function logout(){}export async function resetPassword(){}export async function updateUserProfile(){}export async function changePassword(){}export async function removeAccount(){}`;
const key = 'setwerk.analytics-consent.v1';
(async () => {
  fs.mkdirSync(screenshots, {recursive: true});
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/firebase-service.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(mock); }
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root + path.sep)) { res.statusCode = 403; return res.end(); }
    try { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true, channel: 'chromium'});
    for (const viewport of [{width: 1440, height: 1000}, {width: 390, height: 844}, {width: 320, height: 568}]) {
      const context = await browser.newContext({viewport, serviceWorkers: 'block'});
      let tags = 0;
      await context.route('https://www.googletagmanager.com/**', route => { tags++; return route.fulfill({contentType: 'text/javascript', body: '/* Google tag intercepted for this test. */'}); });
      await context.route('https://*.google-analytics.com/**', route => route.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const origin = 'http://127.0.0.1:' + server.address().port;
      await page.goto(origin);
      const banner = page.locator('#analytics-consent');
      await banner.waitFor();
      assert.equal(tags, 0);
      const bounds = await banner.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({path: path.join(screenshots, 'analytics-' + viewport.width + '.png')});
      await page.locator('[data-analytics-choice="denied"]').click();
      await page.reload();
      assert.equal(await banner.isVisible(), false);
      assert.equal(tags, 0);
      const settings = page.locator('[data-analytics-settings]');
      await settings.click();
      await page.locator('[data-analytics-choice="granted"]').click();
      await page.waitForFunction(() => !!document.querySelector('#setwerk-google-tag'));
      await page.waitForLoadState('networkidle');
      assert.equal(tags, 1);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), 'granted');
      await settings.click();
      await page.locator('[data-analytics-choice="denied"]').click();
      assert.equal(await page.evaluate(() => window['ga-disable-G-LN5XDNS42W']), true);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(JSON.stringify({analyticsBrowserChecks: 'passed', viewports: [1440, 390, 320], noGoogleRequestsBeforeConsent: true, consentWithdrawal: true}));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
