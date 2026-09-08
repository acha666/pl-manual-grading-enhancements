import { defineConfig, devices } from "@playwright/test";

if (!process.env.PLMGE_BASE_URL) {
  throw new Error(
    "Use npm run test:e2e to start an isolated PrairieLearn deployment",
  );
}

export default defineConfig({
  testDir: process.env.PLMGE_REFRESH_STATE === "1" ? "../state" : ".",
  testMatch:
    process.env.PLMGE_REFRESH_STATE === "1" ? "refresh.setup.ts" : "*.spec.ts",
  outputDir: "../../test-results/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLMGE_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
