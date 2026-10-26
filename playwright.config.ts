import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { smtpPort } from './e2e/mail'

// The browser seam: the production build, driven in WebKit with iPhone profiles,
// the closest Linux gets to iOS Safari. With PLAYWRIGHT_BASE_URL set, the same tests
// run against a deployed app instead of a local server (the smoke test after a deploy).
const deployed = process.env.PLAYWRIGHT_BASE_URL

// Locally the server speaks HTTPS, because WebKit blocks http calls from the https://localhost
// page the CORS test fakes. The certificate is throwaway and never committed.
function selfSignedCert() {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-cert-'))
  const [key, cert] = [join(dir, 'key.pem'), join(dir, 'cert.pem')]
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  )
  return {
    NITRO_SSL_KEY: readFileSync(key, 'utf8'),
    NITRO_SSL_CERT: readFileSync(cert, 'utf8'),
  }
}

export default defineConfig({
  testDir: 'e2e',
  globalSetup: deployed ? undefined : './e2e/global-setup.ts',
  forbidOnly: true,
  retries: 0,
  use: {
    baseURL: deployed ?? 'https://127.0.0.1:3100',
    ignoreHTTPSErrors: !deployed,
  },
  projects: [
    { name: 'iphone-15', use: { ...devices['iPhone 15'] } },
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
  ],
  webServer: deployed
    ? undefined
    : {
        command: 'node .output/server/index.mjs',
        url: 'https://127.0.0.1:3100/version',
        ignoreHTTPSErrors: true,
        env: {
          PORT: '3100',
          APP_VERSION: 'e2e',
          PII_HASH_KEY: 'e2e-only-pii-hash-key',
          PUBLIC_URL: 'https://127.0.0.1:3100',
          BANKID_FAKE_PORT: '3101',
          SMTP_URL: `smtp://127.0.0.1:${String(smtpPort)}`,
          MAIL_FROM: 'Assistant <noreply@example.test>',
          STORAGE_DIR: mkdtempSync(join(tmpdir(), 'e2e-files-')),
          RECEIPT_MAIL_ADDRESS: 'kvitto@example.test',
          // Every spec starts from the same few fake IPs, and re-runs share the database.
          BANKID_START_LIMIT: '100000',
          ...selfSignedCert(),
        },
        reuseExistingServer: false,
      },
})
