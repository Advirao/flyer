const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 })
  const page = await browser.newPage()

  page.on('request', req => {
    if (req.url().includes('/api/analyze')) {
      const postData = req.postData() || ''
      try {
        const parsed = JSON.parse(postData)
        console.log('[analyze request]')
        console.log('  imageBase64 length:', parsed.imageBase64?.length ?? 'MISSING')
        console.log('  mediaType:', JSON.stringify(parsed.mediaType ?? 'MISSING'))
      } catch { console.log('  [could not parse request body]') }
    }
  })

  page.on('response', async res => {
    if (res.url().includes('/api/analyze')) {
      let body = ''
      try { body = await res.text() } catch {}
      console.log('[analyze response]', res.status(), body.slice(0, 400))
    }
  })

  console.log('--- Signing in ---')
  await page.goto('https://flyer-nu.vercel.app/auth/signin')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', 'advirao@gmail.com')
  await page.fill('input[type="password"]', 'Drkulk@01')
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])

  if (!page.url().includes('/app')) {
    console.log('[ERROR] Sign in failed')
    await browser.close()
    return
  }
  console.log('[OK] Signed in')

  await page.waitForTimeout(1000)
  const addressInput = page.locator('input[placeholder*="Budde"], input[placeholder*="Address"]').first()
  if (await addressInput.isVisible()) {
    await addressInput.fill('123 Test Street, Houston TX')
    await page.locator('input[placeholder*="DM"], input[placeholder*="contact"]').first().fill('555-1234')
    await page.click('button:has-text("Get Started")')
    await page.waitForTimeout(500)
  }

  console.log('--- Uploading HEIC image ---')
  await page.locator('input[type="file"]').setInputFiles('C:\\Users\\advir\\Desktop\\Selling\\table\\main.HEIC')
  console.log('[OK] File set, watching for API call...')

  // Wait up to 10s to see if the request is even made
  try {
    await page.waitForRequest(r => r.url().includes('/api/analyze'), { timeout: 10000 })
    console.log('[OK] Analyze request was sent')
    // Now wait for response up to 60s
    try {
      await page.waitForResponse(r => r.url().includes('/api/analyze'), { timeout: 60000 })
    } catch {
      console.log('[TIMEOUT] No response within 60s')
    }
  } catch {
    console.log('[NO REQUEST] /api/analyze was never called — HEIC likely has empty file.type')
  }

  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'scripts/heic-result.png', fullPage: true })
  console.log('Screenshot saved to scripts/heic-result.png')

  await browser.close()
})()
