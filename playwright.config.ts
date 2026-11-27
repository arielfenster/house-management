import { defineConfig, devices } from '@playwright/test'

// E2E tests run against a production build (`nuxt build` + `nuxt preview`) on the local Supabase stack
// (`npm run db:start`, keys in .env or the environment). Set E2E_BASE_URL to test an already-running
// server instead (e.g. `E2E_BASE_URL=http://localhost:3000 npm run test:e2e` against `npm run dev`).
const PORT = 3100
const externalBaseURL = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: externalBaseURL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // Phone and desktop widths: the nav is a bottom bar below `md` and a sidebar above it.
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        // CI builds in its own step (then checks the bundle for secrets), so only previews here.
        command: process.env.CI ? 'npm run preview' : 'npm run build && npm run preview',
        env: { PORT: String(PORT) },
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
})
