import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'http://localhost:3008'
const SCREENSHOTS = './screenshots'
const TEST_EMAIL = `test_${Date.now()}@example.com`
const TEST_PASS = 'Test1234!'

fs.mkdirSync(SCREENSHOTS, { recursive: true })

async function shot(page, name) {
  const file = path.join(SCREENSHOTS, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`📸 ${name}`)
}

// Pre-warm routes so Next.js compiles them before the demo (avoids Fast Refresh mid-test)
console.log('Pre-warming routes...')
try {
  await Promise.all([
    fetch(`${BASE}/auth/signup`),
    fetch(`${BASE}/auth/signin`),
    fetch(`${BASE}/app`),
    fetch(`${BASE}/api/auth/session`),
    fetch(`${BASE}/api/signup`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' }),
  ])
} catch { /* ignore */ }
console.log('Routes warmed. Starting demo...\n')

const browser = await chromium.launch({ headless: false, slowMo: 400 })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

// Capture all console output from browser
page.on('console', msg => console.log(`  [browser ${msg.type()}] ${msg.text()}`))
page.on('pageerror', err => console.log(`  [page error] ${err.message}`))

// ── 1. Landing page ─────────────────────────────────────────────────────
console.log('\n── 1. Landing page ──')
await page.goto(BASE)
await page.waitForLoadState('networkidle')
await shot(page, '01-landing')

// ── 2. Navigate to Sign Up ───────────────────────────────────────────────
console.log('\n── 2. Sign Up page ──')
await page.click('a[href="/auth/signup"]')
await page.waitForLoadState('networkidle')
await shot(page, '02-signup-page')

// ── 3. Fill signup form ──────────────────────────────────────────────────
console.log(`\n── 3. Fill signup: ${TEST_EMAIL} ──`)
await page.fill('input[name="email"]', TEST_EMAIL)
await page.fill('input[name="password"]', TEST_PASS)
await page.fill('input[name="confirmPassword"]', TEST_PASS)
await shot(page, '03-signup-filled')

// ── 4. Submit signup ─────────────────────────────────────────────────────
console.log('\n── 4. Submit signup ──')
await page.click('button[type="submit"]')

// Wait up to 30s for signup + auto-signin redirect (DB + bcrypt + signIn chain)
try {
  await Promise.race([
    page.waitForURL(url => !url.includes('/auth/signup'), { timeout: 30000 }),
    page.waitForSelector('div.bg-red-50', { timeout: 30000 }),
  ])
} catch {
  // Navigation may have happened but was missed (HMR during compile)
  // Give it a few more seconds to settle
  try { await page.waitForURL(url => !url.includes('/auth/signup'), { timeout: 8000 }) } catch {}
  console.log(`  URL after extra wait: ${page.url()}`)
}

await shot(page, '04-after-signup')
console.log(`  URL: ${page.url()}`)

// ── 5. If we ended up on /app → signed in successfully ──────────────────
if (page.url().includes('/app')) {
  console.log('\n── 5. Auto sign-in after signup worked! ──')
  await shot(page, '05-app-autologin')
} else if (page.url().includes('/auth/signin')) {
  console.log('\n── 5. Redirected to sign-in (auto-login fallback) ──')
  await page.waitForLoadState('networkidle')
  const successBanner = page.locator('text=Account created')
  if (await successBanner.count() > 0) console.log('  ✓ "Account created" banner visible')
  await page.fill('input[name="email"]', TEST_EMAIL)
  await page.fill('input[name="password"]', TEST_PASS)
  await shot(page, '05-signin-after-signup')
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL(url => url.includes('/app'), { timeout: 10000 })
  } catch {
    console.log('  [warn] did not land on /app')
  }
  await shot(page, '06-after-signin')
  console.log(`  URL: ${page.url()}`)
}

// ── 6. /app page while signed in ────────────────────────────────────────
console.log('\n── 6. /app page (signed in) ──')
await page.goto(`${BASE}/app`)
await page.waitForLoadState('networkidle')
await shot(page, '07-app-loggedin')
const hasSignOut = await page.locator('button:has-text("Sign out"), button[title="Sign out"]').count()
console.log(`  Sign-out button visible: ${hasSignOut > 0}`)

// Fill settings if modal appears
const settingsModal = page.locator('text=Welcome! Quick setup')
if (await settingsModal.count() > 0) {
  console.log('\n── 6b. Filling settings modal ──')
  await page.fill('input[placeholder*="Budde"], input[placeholder*="address"], input[placeholder*="Address"]', '123 Main St, Houston, TX')
  await page.fill('input[placeholder*="DM"], input[placeholder*="346"], input[placeholder*="contact"]', 'Call 555-1234')
  await page.click('button:has-text("Get Started")')
  await page.waitForLoadState('networkidle')
  await shot(page, '07b-app-settings-done')
}

// ── 7. Sign out ──────────────────────────────────────────────────────────
console.log('\n── 7. Sign out ──')
const signOutBtn = page.locator('button:has-text("Sign out"), button[title="Sign out"]').first()
if (await signOutBtn.count() > 0) {
  await signOutBtn.click()
  try {
    await page.waitForURL(url => url.includes('/'), { timeout: 8000 })
  } catch {}
  await shot(page, '08-after-signout')
  console.log(`  URL: ${page.url()}`)
} else {
  console.log('  [warn] no sign-out button found')
}

// ── 8. /app while logged out ─────────────────────────────────────────────
console.log('\n── 8. /app while logged out ──')
await page.goto(`${BASE}/app`)
await page.waitForLoadState('networkidle')
await shot(page, '09-app-logged-out')
console.log(`  URL: ${page.url()} (should be /app or redirect to /auth/signin)`)

// ── 9. Sign in with the same account ────────────────────────────────────
console.log('\n── 9. Sign in page ──')
await page.goto(`${BASE}/auth/signin`)
await page.waitForLoadState('networkidle')
// Wait for React hydration by waiting for the form to be interactive
await page.waitForSelector('input[name="email"]', { state: 'visible' })
await page.fill('input[name="email"]', TEST_EMAIL)
await page.fill('input[name="password"]', TEST_PASS)
await shot(page, '10-signin-filled')

await page.click('button[type="submit"]')
try {
  await page.waitForURL(url => url.includes('/app'), { timeout: 20000 })
  await shot(page, '11-signin-success')
  console.log(`  ✅ Sign-in succeeded → ${page.url()}`)
} catch {
  await shot(page, '11-signin-result')
  const err = await page.locator('div.bg-red-50 span').last().textContent().catch(() => 'none')
  console.log(`  URL after sign-in: ${page.url()}`)
  if (err !== 'none') console.log(`  Error: ${err}`)
}

console.log('\n✅ Navigation demo complete. Screenshots in ./screenshots/')
await browser.close()
