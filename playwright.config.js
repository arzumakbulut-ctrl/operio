import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:      './tests/e2e',
  timeout:       30_000,
  retries:       process.env.CI ? 2 : 0,
  workers:       process.env.CI ? 2 : 4,
  reporter: [
    ['html',  { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  use: {
    baseURL:     process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace:       'on-first-retry',   // Başarısız testlerde trace kaydet
    screenshot:  'only-on-failure',  // Başarısız testlerde ekran görüntüsü
    video:       'retain-on-failure',
    locale:      'tr-TR',
    timezoneId:  'Europe/Istanbul',
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
    {
      name:  'firefox',
      use:   { ...devices['Desktop Firefox'] },
    },
    {
      name:  'mobile-chrome',
      use:   { ...devices['Pixel 5'] },
    },
    // Safari sadece Mac'te
    ...(process.platform === 'darwin' ? [{
      name: 'webkit',
      use:  { ...devices['Desktop Safari'] },
    }] : []),
  ],

  // Test öncesi frontend'i başlat (opsiyonel — CI'da ayrı başlatılabilir)
  // webServer: {
  //   command: 'npm run dev',
  //   url:     'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60_000,
  // },
});
