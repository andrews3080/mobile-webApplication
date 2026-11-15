import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Reads the .env file in the project root (if there is one) into process.env
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
