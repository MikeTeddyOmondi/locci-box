import { beforeAll } from "vitest";
import { initDb } from "../src/db/index.js";

beforeAll(async () => {
  await initDb();
}, 30_000);
