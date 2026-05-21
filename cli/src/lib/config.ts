import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import type { Config, Profile } from "../types/index.js";

const CONFIG_DIR = join(homedir(), ".locci", "box");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// Temporary migration shim — remove after v1.4.x
const LEGACY_CONFIG_DIR = join(homedir(), ".loccibox");
const LEGACY_CONFIG_FILE = join(LEGACY_CONFIG_DIR, "config.json");

/**
 * Get the default config structure
 */
function getDefaultConfig(): Config {
  return {
    default: "local",
    profiles: {},
  };
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Migrate config from ~/.loccibox/ → ~/.locci/box/ (temporary, remove after v1.4.x).
 * Runs once: copies the old file to the new location then deletes the old directory.
 */
function migrateIfNeeded(): void {
  if (!existsSync(LEGACY_CONFIG_FILE)) return;
  if (existsSync(CONFIG_FILE)) return; // already migrated

  ensureConfigDir();
  const content = readFileSync(LEGACY_CONFIG_FILE, "utf-8");
  writeFileSync(CONFIG_FILE, content, "utf-8");
  try {
    rmSync(LEGACY_CONFIG_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
  console.log(
    "ℹ  Migrated config: ~/.loccibox/ → ~/.locci/box/ (this message appears once)",
  );
}

/**
 * Load configuration from ~/.locci/box/config.json
 * Falls back to environment variables if config doesn't exist
 */
export function loadConfig(): Config {
  migrateIfNeeded();
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return getDefaultConfig();
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading config file:", error);
    return getDefaultConfig();
  }
}

/**
 * Save configuration to ~/.loccibox/config.json
 */
export function saveConfig(config: Config): void {
  ensureConfigDir();

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    throw new Error(`Failed to save config: ${error}`);
  }
}

/**
 * Get a specific profile by name
 * Falls back to environment variables if profile doesn't exist
 */
export function getProfile(name?: string): Profile | null {
  const config = loadConfig();
  const profileName = name || config.default;

  // Try to get from config
  if (config.profiles[profileName]) {
    return config.profiles[profileName];
  }

  // Fallback to environment variables
  const envUrl = process.env.LOCCIBOX_API_URL;
  const envKey = process.env.LOCCIBOX_API_KEY;

  if (envUrl && envKey) {
    return {
      apiUrl: envUrl,
      apiKey: envKey,
    };
  }

  return null;
}

/**
 * Set a profile in the config
 */
export function setProfile(name: string, profile: Profile): void {
  const config = loadConfig();
  config.profiles[name] = profile;
  saveConfig(config);
}

/**
 * Set the default profile
 */
export function setDefaultProfile(name: string): void {
  const config = loadConfig();
  config.default = name;
  saveConfig(config);
}

/**
 * Check if config exists
 */
export function configExists(): boolean {
  return existsSync(CONFIG_FILE);
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

// Made with Bob
