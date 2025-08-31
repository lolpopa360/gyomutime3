import { test, expect } from '@playwright/test'

test('랜딩 페이지 로드', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('교무타임 – 파일 브로커')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Google로 시작하기' })).toBeVisible()
})

