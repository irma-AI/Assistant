import { defineConfig, devices } from '@playwright/test'

// The browser seam: the production build, driven in WebKit with iPhone profiles,
// the closest Linux gets to iOS Safari. With PLAYWRIGHT_BASE_URL set, the same tests
// run against a deployed app instead of a local server (the smoke test after a deploy).
const deployed = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  retries: 0,
  use: { baseURL: deployed ?? 'http://127.0.0.1:3100' },
  projects: [
    { name: 'iphone-15', use: { ...devices['iPhone 15'] } },
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
  ],
  webServer: deployed
    ? undefined
    : {
        command: 'node .output/server/index.mjs',
        url: 'http://127.0.0.1:3100/version',
        env: { PORT: '3100', APP_VERSION: 'e2e' },
        reuseExistingServer: false,
      },
})
