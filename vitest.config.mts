import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Read the .env file in the project root so the tests can find TEST_DATABASE_URL
config({ path: ".env", quiet: true });

export default defineConfig({
  test: {
    env: { TEST_DATABASE_URL: process.env["TEST_DATABASE_URL"] ?? "" },
  },
});
