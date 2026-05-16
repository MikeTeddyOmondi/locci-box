import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import type { Config, Profile } from "../types/index.js";

const CONFIG_DIR = join(homedir(), ".loccibox");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

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
 * Load configuration from ~/.loccibox/config.json
 * Falls back to environment variables if config doesn't exist
 */
export function loadConfig(): Config {
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
