import { Command } from "commander";
import * as clack from "@clack/prompts";
import { readFileSync } from "node:fs";
import { getProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import {
  printError,
  printBox,
  printMetadata,
  formatDuration,
} from "../lib/output.js";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../types/index.js";
import pc from "picocolors";

/**
 * Run command - Execute code in a sandbox
 */
export function createRunCommand(): Command {
  const command = new Command("run");

  command
    .description("Execute code in an isolated sandbox")
    .option(
      "-l, --lang <language>",
      `Programming language (${SUPPORTED_LANGUAGES.join(", ")})`,
    )
    .option("-c, --code <code>", "Code to execute (inline)")
    .option("-f, --file <path>", "Path to file containing code")
    .option("-t, --timeout <seconds>", "Execution timeout in seconds", "30")
    .option("--profile <name>", "Use a specific profile")
    .action(async (options) => {
      await runCommand(options);
    });

  return command;
}

/** One-line programs that run as typed, shown in the code prompt. */
const EXAMPLES: Record<SupportedLanguage, string> = {
  python: "print('Hello, World!')",
  node: "console.log('Hello, World!')",
  bash: "echo Hello, World!",
  ruby: "puts 'Hello, World!'",
  go: 'package main; import "fmt"; func main() { fmt.Println("Hello, World!") }',
  rust: 'fn main() { println!("Hello, World!"); }',
  c: 'int main(void) { __builtin_printf("Hello, World!\\n"); return 0; }',
  cpp: 'int main() { __builtin_printf("Hello, World!\\n"); }',
};

interface RunOptions {
  lang?: string;
  code?: string;
  file?: string;
  timeout?: string;
  profile?: string;
}

async function runCommand(options: RunOptions): Promise<void> {
  // Get profile
  const profile = getProfile(options.profile);
  if (!profile) {
    printError(
      "No configuration found. Run 'loccibox init' first or set LOCCIBOX_API_URL and LOCCIBOX_API_KEY environment variables.",
    );
    process.exit(1);
  }

  // Get language
  let language = options.lang as SupportedLanguage | undefined;
  if (!language) {
    const langInput = await clack.select({
      message: "Select programming language",
      options: [
        { value: "python", label: "Python" },
        { value: "node", label: "Node.js" },
        { value: "bash", label: "Bash" },
        { value: "ruby", label: "Ruby" },
        { value: "go", label: "Go" },
        { value: "rust", label: "Rust" },
        { value: "c", label: "C" },
        { value: "cpp", label: "C++" },
      ],
    });

    if (clack.isCancel(langInput)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    language = langInput as SupportedLanguage;
  }

  // Validate language
  const validLanguages: readonly SupportedLanguage[] = SUPPORTED_LANGUAGES;
  if (!validLanguages.includes(language)) {
    printError(
      `Invalid language: ${language}. Supported: ${validLanguages.join(", ")}`,
    );
    process.exit(1);
  }

  // Get code
  let code = options.code;

  if (options.file) {
    // Read from file
    try {
      code = readFileSync(options.file, "utf-8");
    } catch (error) {
      printError(`Failed to read file: ${options.file}`);
      process.exit(1);
    }
  } else if (!code) {
    // Prompt for code
    const codeInput = await clack.text({
      message: "Enter your code (one line; use -f <file> for a longer program)",
      placeholder: EXAMPLES[language],
      validate: (value) => {
        if (!value) return "Code is required";
        return undefined;
      },
    });

    if (clack.isCancel(codeInput)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    code = codeInput;
  }

  // Parse timeout
  const timeout = parseInt(options.timeout || "30", 10);

  // Execute code
  const s = clack.spinner();
  s.start("Spinning up your Locci Box...");

  try {
    const api = createAPIClient(profile.apiUrl, profile.apiKey);
    const result = await api.runSandbox({
      language,
      code,
      timeout,
    });

    s.stop(
      pc.green(`✓ Execution complete`) +
        pc.dim(` [${formatDuration(result.duration_ms)}]`),
    );

    // Display stdout
    if (result.stdout) {
      printBox("stdout", result.stdout, "green");
    }

    // Display stderr
    if (result.stderr) {
      printBox("stderr", result.stderr, "yellow");
    }

    // Display metadata
    printMetadata({
      "exit code":
        result.exit_code === 0
          ? pc.green(result.exit_code)
          : pc.red(result.exit_code),
      sandbox: pc.dim(result.sandbox_id),
      duration: formatDuration(result.duration_ms),
    });

    console.log("");

    // Exit with same code as sandbox
    process.exit(result.exit_code);
  } catch (error) {
    s.stop(pc.red("✗ Execution failed"));
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

// Made with Bob
