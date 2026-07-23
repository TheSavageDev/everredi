import { expect, test } from '@playwright/test';

test('marketing home shows EverRedi brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('EverRedi').first()).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /Know what is in every kit/i,
    }),
  ).toBeVisible();
});

test('pricing page loads', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Simple pricing')).toBeVisible();
  await expect(page.getByText('$4.99')).toBeVisible();
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
