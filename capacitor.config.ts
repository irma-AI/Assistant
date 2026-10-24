import type { CapacitorConfig } from '@capacitor/cli'

// The origins stay at the defaults, capacitor://localhost and https://localhost, which the API's CORS allows.
const config: CapacitorConfig = {
  appId: 'se.example.redo',
  appName: 'Redo (dev)',
  webDir: '.output/native',
  server: { appStartPath: '/app' },
}

export default config
