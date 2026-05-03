const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const TEST_IMAGE_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='
const TEST_IMAGE_PATH = path.join(__dirname, 'test.jpg')

fs.writeFileSync(TEST_IMAGE_PATH, Buffer.from(TEST_IMAGE_B64, 'base64'))

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 })
  const page = await browser.newPage()

  page.on('response', async res => {
    if (res.url().includes('/api/analyze')) {
      let body = ''
      try { body = await res.text() } catch {}
      console.log('[/api/analyze response]', res.status(), body.slice(0, 500))
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

  console.log('--- Uploading image, waiting up to 30s for response ---')
  await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE_PATH)

  // Wait up to 30 seconds for the analyze response
  try {
    await page.waitForResponse(r => r.url().includes('/api/analyze'), { timeout: 30000 })
    console.log('[OK] Got analyze response')
  } catch {
    console.log('[TIMEOUT] No response from /api/analyze within 30s')
  }

  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'scripts/analyze-result.png', fullPage: true })
  console.log('Screenshot saved')

  // Check page for errors or filled fields
  const titleField = page.locator('input[placeholder*="For Sale"]').first()
  const titleValue = await titleField.inputValue().catch(() => '')
  console.log('Title field value:', titleValue || '[empty]')

  const errorEl = page.locator('text=Missing image, text=Analysis failed, text=please fill').first()
  if (await errorEl.count()) {
    console.log('[page error]', await errorEl.textContent())
  }

  await browser.close()
  fs.unlinkSync(TEST_IMAGE_PATH)
})()
