import { defineConfig, devices } from '@playwright/test'

// The browser seam: the production build, driven in WebKit with iPhone profiles,
// the closest Linux gets to iOS Safari.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:3100' },
  projects: [
    { name: 'iphone-15', use: { ...devices['iPhone 15'] } },
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
  ],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: 'http://127.0.0.1:3100/version',
    env: { PORT: '3100', APP_VERSION: 'e2e' },
    reuseExistingServer: false,
  },
})
