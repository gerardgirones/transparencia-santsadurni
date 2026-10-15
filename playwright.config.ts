import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", {open:"never"}]] : "list",
  use: {baseURL:"http://127.0.0.1:3210", trace:"retain-on-failure"},
  projects: [
    {name:"mobile",use:{...devices["iPhone 13"],browserName:"chromium",defaultBrowserType:"chromium"}},
    {name:"desktop",use:{...devices["Desktop Chrome"]}},
  ],
  webServer: {
    command:"node --import ./tests/fixtures/mock-fetch.mjs node_modules/next/dist/bin/next start -p 3210",
    url:"http://127.0.0.1:3210/about",
    env:{NEXT_TEST_BUILD:"1", MOCK_ANALYSIS_FAILURE:"1"},
    timeout:60000,
  },
});
