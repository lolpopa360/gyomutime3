import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './web/tests/e2e',
  fullyParallel: true,
  retries: 0,
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm --workspace web run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

