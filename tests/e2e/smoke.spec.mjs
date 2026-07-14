import { expect, test } from '@playwright/test'

test('Enclume Codex répond et rend sa page sans exception JavaScript', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

  expect(response, 'La navigation doit produire une réponse HTTP').not.toBeNull()
  expect(response.status(), 'La page principale doit répondre sans erreur HTTP').toBeLessThan(400)
  await expect(page).toHaveTitle(/Enclume/i)
  await expect(page.locator('body')).not.toBeEmpty()

  await page.waitForLoadState('networkidle')
  expect(pageErrors, `Exceptions JavaScript détectées :\n${pageErrors.join('\n')}`).toEqual([])
})
