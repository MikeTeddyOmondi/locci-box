import pc from "picocolors";

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(pc.green("✓") + " " + message);
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(pc.red("✗") + " " + pc.red(message));
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.warn(pc.yellow("⚠") + " " + pc.yellow(message));
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  console.log(pc.blue("ℹ") + " " + message);
}

/**
 * Print a table with data
 */
export function printTable(
  data: Record<string, any>[],
  columns: { key: string; label: string; width?: number }[],
): void {
  if (data.length === 0) {
    console.log(pc.dim("No data to display"));
    return;
  }

  // Print header
  const header = columns.map((col) => pc.bold(col.label)).join("  ");
  console.log("\n" + header);
  console.log(pc.dim("─".repeat(80)));

  // Print rows
  data.forEach((row) => {
    const rowStr = columns
      .map((col) => {
        const value = row[col.key] ?? "";
        const str = String(value);
        return col.width ? str.padEnd(col.width) : str;
      })
      .join("  ");
    console.log(rowStr);
  });

  console.log("");
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format ISO timestamp to relative time
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }
  return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;
}

/**
 * Print a bordered box with content
 */
export function printBox(
  title: string,
  content: string,
  color?: "green" | "yellow" | "red",
): void {
  const lines = content.split("\n");
  const maxLength = Math.max(...lines.map((l) => l.length), title.length);
  const width = Math.min(maxLength + 4, 80);

  const colorFn =
    color === "green"
      ? pc.green
      : color === "yellow"
        ? pc.yellow
        : color === "red"
          ? pc.red
          : (s: string) => s;

  console.log("");
  console.log(
    colorFn(
      "┌─ " +
        title +
        " " +
        "─".repeat(Math.max(0, width - title.length - 4)) +
        "┐",
    ),
  );
  lines.forEach((line) => {
    console.log(
      colorFn("│") + "  " + line.padEnd(width - 4) + "  " + colorFn("│"),
    );
  });
  console.log(colorFn("└" + "─".repeat(width - 2) + "┘"));
  console.log("");
}

/**
 * Print metadata in a formatted way
 */
export function printMetadata(data: Record<string, any>): void {
  const maxKeyLength = Math.max(...Object.keys(data).map((k) => k.length));

  Object.entries(data).forEach(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLength);
    console.log(pc.dim(`  ${paddedKey}  `) + value);
  });
}

// Made with Bob
