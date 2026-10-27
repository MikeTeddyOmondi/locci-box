import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import pc from "picocolors";
import { getProfile } from "../lib/config.js";
import { createAPIClient, type LocciBoxAPI } from "../lib/api.js";
import { formatDuration, formatTimestamp, printError, printMetadata, printTable } from "../lib/output.js";
import { SUPPORTED_LANGUAGES, type BoxInfo } from "../types/index.js";

/**
 * `loccibox box`: agent boxes from the terminal, the same operations as the
 * box_* MCP tools. A box is a Debian microVM that keeps running between calls
 * and keeps its disk after a stop; work happens in /workspace.
 */
export function createBoxCommand(): Command {
  const box = new Command("box").description(
    "Agent boxes: long-lived Linux microVMs you run commands in (create, exec, shell, files)",
  );

  box
    .command("create")
    .description("Create a box (or reattach to one with --attach) and print its id")
    .option("-l, --language <language>", `Toolchain to come with: ${SUPPORTED_LANGUAGES.join(", ")} (default node)`)
    .option("--attach <box_id>", "Start or reattach to an existing box instead")
    .option("--profile <name>", "Use a specific profile")
    .action(async (opts: { language?: string; attach?: string; profile?: string }) =>
      run(opts.profile, async (api) => {
        const info = await api.createBox(opts.attach, opts.language);
        if (!process.stdout.isTTY) return console.log(info.box_id);
        console.log("");
        console.log(pc.green(`✓ Box ${opts.attach ? "attached" : "created"}: `) + pc.bold(info.box_id));
        printInfo(info);
        console.log(pc.dim(`  Next: loccibox box shell ${info.box_id}`));
        console.log("");
      }),
    );

  box
    .command("list")
    .alias("ls")
    .description("List your boxes, running and stopped")
    .option("--profile <name>", "Use a specific profile")
    .action(async (opts: { profile?: string }) =>
      run(opts.profile, async (api) => {
        const boxes = await api.listBoxes();
        if (boxes.length === 0) {
          console.log(pc.dim("\n  No boxes. Create one with: loccibox box create\n"));
          return;
        }
        console.log("");
        console.log(pc.bold(`Boxes (${boxes.length})`));
        printTable(
          boxes.map((b) => ({
            id: b.box_id,
            status: b.status === "running" ? pc.green(b.status) : pc.yellow(b.status),
            memory: `${b.memory_mib} MiB`,
            used: formatTimestamp(b.last_used_at),
            created: formatTimestamp(b.created_at),
          })),
          [
            { key: "id", label: "BOX ID", width: 18 },
            { key: "status", label: "STATUS", width: 10 },
            { key: "memory", label: "MEMORY", width: 10 },
            { key: "used", label: "LAST USED", width: 20 },
            { key: "created", label: "CREATED", width: 20 },
          ],
        );
      }),
    );

  box
    .command("info")
    .description("Show one box")
    .argument("<box_id>")
    .option("--profile <name>", "Use a specific profile")
    .action(async (id: string, opts: { profile?: string }) =>
      run(opts.profile, async (api) => {
        console.log("");
        printInfo(await api.getBox(id));
        console.log("");
      }),
    );

  box
    .command("exec")
    .description("Run a shell command in a box (sh -c, in /workspace). Put -- before a command with flags")
    .argument("<box_id>")
    .argument("<command...>", "The command; quote it, or put it after --")
    .option("-t, --timeout <seconds>", "Stop the command after this long (default 120, max 600)")
    .option("--profile <name>", "Use a specific profile")
    .action(async (id: string, words: string[], opts: { timeout?: string; profile?: string }) =>
      run(opts.profile, async (api) => {
        const result = await api.execBox(id, words.join(" "), seconds(opts.timeout));
        // Raw output, so it pipes like a local command; the exit code is the command's.
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        if (result.timed_out) process.stderr.write(pc.yellow(`\n(timed out; exit ${result.exit_code})\n`));
        process.exitCode = result.exit_code;
      }),
    );

  box
    .command("shell")
    .description("An interactive shell in a box: each line runs there; cd is remembered; exit to leave")
    .argument("<box_id>")
    .option("-t, --timeout <seconds>", "Per-command timeout (default 120, max 600)")
    .option("--profile <name>", "Use a specific profile")
    .action(async (id: string, opts: { timeout?: string; profile?: string }) =>
      run(opts.profile, async (api) => shell(api, id, seconds(opts.timeout))),
    );

  box
    .command("write")
    .description("Write a file into a box: from --file, --content, or standard input")
    .argument("<box_id>")
    .argument("<path>", "Path in the box; relative paths are under /workspace")
    .option("-f, --file <local_path>", "Local file to upload (any bytes)")
    .option("-c, --content <text>", "Text to write")
    .option("--profile <name>", "Use a specific profile")
    .action(async (id: string, path: string, opts: { file?: string; content?: string; profile?: string }) =>
      run(opts.profile, async (api) => {
        let written;
        if (opts.file) {
          written = await api.writeBoxFile(id, path, readFileSync(opts.file).toString("base64"), "base64");
        } else if (opts.content !== undefined) {
          written = await api.writeBoxFile(id, path, opts.content);
        } else if (!process.stdin.isTTY) {
          written = await api.writeBoxFile(id, path, (await readStdin()).toString("base64"), "base64");
        } else {
          throw new Error("Nothing to write: pass --file, --content, or pipe it in");
        }
        console.error(pc.green(`✓ Wrote ${written.size} bytes to ${written.path}`));
      }),
    );

  box
    .command("read")
    .description("Read a file from a box (up to 1 MB) to standard output, or to --output")
    .argument("<box_id>")
    .argument("<path>", "Path in the box; relative paths are under /workspace")
    .option("-o, --output <local_path>", "Save to this local file")
    .option("--profile <name>", "Use a specific profile")
    .action(async (id: string, path: string, opts: { output?: string; profile?: string }) =>
      run(opts.profile, async (api) => {
        const file = await api.readBoxFile(id, path);
        const bytes = Buffer.from(file.content, file.encoding === "base64" ? "base64" : "utf8");
        if (opts.output) {
          writeFileSync(opts.output, bytes);
          console.error(pc.green(`✓ Saved ${bytes.length} bytes to ${opts.output}`));
        } else {
          process.stdout.write(bytes);
        }
        if (file.truncated) console.error(pc.yellow(`(truncated: the file is ${file.size} bytes)`));
      }),
    );

  box
    .command("stop")
    .description("Stop a box, keeping its disk (the next call starts it again); --rm deletes it")
    .argument("<box_id>")
    .option("--rm", "Delete the box and its /workspace instead")
    .option("--profile <name>", "Use a specific profile")
    .action(async (id: string, opts: { rm?: boolean; profile?: string }) =>
      run(opts.profile, async (api) => {
        if (opts.rm) {
          await api.removeBox(id);
          console.log(pc.green(`✓ Box ${id} deleted`));
        } else {
          await api.stopBox(id);
          console.log(pc.green(`✓ Box ${id} stopped`) + pc.dim(" (its disk is kept)"));
        }
      }),
    );

  box
    .command("rm")
    .description("Delete a box and its /workspace")
    .argument("<box_id>")
    .option("--profile <name>", "Use a specific profile")
    .action(async (id: string, opts: { profile?: string }) =>
      run(opts.profile, async (api) => {
        await api.removeBox(id);
        console.log(pc.green(`✓ Box ${id} deleted`));
      }),
    );

  return box;
}

/** Run `fn` with the profile's API client; errors print and exit 1. */
async function run(profileName: string | undefined, fn: (api: LocciBoxAPI) => Promise<void>): Promise<void> {
  const profile = getProfile(profileName);
  if (!profile) {
    printError(
      "No configuration found. Run 'loccibox init' first or set LOCCIBOX_API_URL and LOCCIBOX_API_KEY environment variables.",
    );
    process.exit(1);
  }
  try {
    await fn(createAPIClient(profile.apiUrl, profile.apiKey));
  } catch (error) {
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

function seconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid timeout: ${value}`);
  return n;
}

function printInfo(b: BoxInfo): void {
  printMetadata({
    box: b.box_id,
    status: b.status === "running" ? pc.green(b.status) : pc.yellow(b.status),
    image: pc.dim(b.image),
    memory: `${b.memory_mib} MiB`,
    workdir: b.workdir,
    "idle stop": b.idle_stop_at ? formatTimestamp(b.idle_stop_at) : "—",
  });
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Printed after each command so the shell knows the box's working folder. */
const PWD_MARK = "__LOCCIBOX_PWD__";

/**
 * Each line runs as its own `sh -c` in the box, so the shell itself does not
 * persist; the folder does: every command starts with a cd to where the last
 * one ended. Files and installs persist, as in any box call.
 */
async function shell(api: LocciBoxAPI, id: string, timeout: number | undefined): Promise<void> {
  const info = await api.createBox(id); // starts it if it was stopped
  let cwd = info.workdir;
  console.log(pc.dim(`Connected to ${id} (${info.image}). Each line runs in the box; "exit" or Ctrl+D leaves.`));
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  // Piped input ends while a command still runs; its remaining lines still arrive, with no prompt.
  let closed = false;
  rl.on("close", () => (closed = true));
  const prompt = () => {
    if (closed) return;
    rl.setPrompt(`${pc.cyan(id)}:${pc.blue(cwd)}$ `);
    rl.prompt();
  };
  prompt();
  for await (const line of rl) {
    const command = line.trim();
    if (command === "exit" || command === "logout") break;
    if (command) {
      const started = Date.now();
      try {
        const script = `cd ${quote(cwd)} 2>/dev/null || cd /workspace\n${command}\n__s=$?\nprintf '\\n${PWD_MARK}%s' "$PWD"\nexit $__s`;
        const result = await api.execBox(id, script, timeout);
        const at = result.stdout.lastIndexOf(`\n${PWD_MARK}`);
        if (at >= 0) {
          cwd = result.stdout.slice(at + PWD_MARK.length + 1).trim() || cwd;
          process.stdout.write(result.stdout.slice(0, at));
        } else {
          process.stdout.write(result.stdout);
        }
        process.stderr.write(result.stderr);
        if (result.timed_out) {
          console.log(pc.yellow(`(timed out after ${formatDuration(Date.now() - started)}; exit ${result.exit_code})`));
        } else if (result.exit_code !== 0) {
          console.log(pc.red(`(exit ${result.exit_code})`));
        }
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
      }
    }
    prompt();
  }
  rl.close();
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
