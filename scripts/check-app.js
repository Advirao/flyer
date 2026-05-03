const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 })
  const page = await browser.newPage()

  page.on('console', msg => console.log('[browser console]', msg.type(), msg.text()))
  page.on('response', res => {
    if (!res.ok() && res.url().includes('flyer-nu.vercel.app')) {
      console.log('[HTTP error]', res.status(), res.url())
    }
  })

  console.log('\n--- Testing signup ---')
  await page.goto('https://flyer-nu.vercel.app/auth/signup')
  await page.waitForLoadState('networkidle')
  console.log('Page title:', await page.title())

  // Fill signup form
  await page.fill('input[type="email"]', 'testuser123@example.com')
  await page.fill('input[type="password"]', 'TestPass@99')
  const confirmInput = page.locator('input[placeholder*="onfirm"], input[name*="onfirm"]').first()
  if (await confirmInput.count()) {
    await confirmInput.fill('TestPass@99')
  }

  // Intercept the signup API call
  const [signupRes] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/signup'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])

  const status = signupRes.status()
  let body = ''
  try { body = await signupRes.text() } catch {}
  console.log('[signup response]', status, body)

  // Check for error message on page
  await page.waitForTimeout(2000)
  const errorEl = await page.locator('text=Something went wrong, text=Error, text=wrong').first()
  if (await errorEl.count()) {
    console.log('[page error]', await errorEl.textContent())
  }

  const pageText = await page.textContent('body')
  if (pageText.includes('sign in') || pageText.includes('Sign in') || pageText.includes('/app')) {
    console.log('[result] Signup appears to have succeeded (redirected)')
  }

  console.log('\n--- Testing signin ---')
  await page.goto('https://flyer-nu.vercel.app/auth/signin')
  await page.waitForLoadState('networkidle')

  await page.fill('input[type="email"]', 'advirao@gmail.com')
  await page.fill('input[type="password"]', 'Drkulk@01')

  await page.click('button[type="submit"]')
  await page.waitForTimeout(3000)

  const currentUrl = page.url()
  console.log('[signin result] Current URL:', currentUrl)

  const signinError = await page.locator('[class*="error"], [class*="alert"], .text-red').first()
  if (await signinError.count()) {
    console.log('[signin error on page]', await signinError.textContent())
  }

  await page.screenshot({ path: 'scripts/result.png', fullPage: true })
  console.log('\nScreenshot saved to scripts/result.png')

  await browser.close()
})()
