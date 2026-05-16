---
url: "https://docs.microsandbox.dev/sdk/typescript/sandbox"
title: "Sandbox - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/sandbox#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

See [Overview](https://docs.microsandbox.dev/sandboxes/overview) for configuration examples and [Lifecycle](https://docs.microsandbox.dev/sandboxes/lifecycle) for state management.The TypeScript SDK uses a **builder-only** entry point. Start every new sandbox from `Sandbox.builder(name)` and chain configuration calls before terminating with `.create()` or `.createDetached()`.

```
import { Sandbox } from "microsandbox";

await using sandbox = await Sandbox.builder("demo")
  .image("alpine")
  .cpus(1)
  .memory(512)
  .create();
```

## [Static methods​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#static-methods)  

---

#### [Sandbox.builder()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandbox-builder)  

```
static builder(name: string): SandboxBuilder
```

Begin building a new sandbox. Configure it with chainable setters, then call `.create()` or `.createDetached()` to boot it.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Sandbox name |

**Returns**

| Type | Description |
| --- | --- |
| [`SandboxBuilder`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxbuilder) | Fluent builder |

#### [Sandbox.get()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandbox-get)  

```
static get(name: string): Promise<SandboxHandle>
```

Get a handle to an existing sandbox (running or stopped). The handle provides status, configuration, and lifecycle control.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Sandbox name |

**Returns**

| Type | Description |
| --- | --- |
| [`SandboxHandle`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxhandle) | Handle with status and lifecycle control |

---

#### [Sandbox.list()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandbox-list)  

```
static list(): Promise<SandboxHandle[]>
```

List all sandboxes (running, stopped, and crashed). Handles returned from `list()` are read-only — call `Sandbox.get(name)` to get a live handle for lifecycle calls.**Returns**

| Type | Description |
| --- | --- |
| [`SandboxHandle[]`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxhandle) | All sandboxes (read-only handles) |

---

#### [Sandbox.remove()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandbox-remove)  

```
static remove(name: string): Promise<void>
```

Delete a stopped sandbox and all its state from disk. Fails if the sandbox is still running.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Sandbox name |

---

#### [Sandbox.start()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandbox-start)  

```
static start(name: string): Promise<Sandbox>
```

Restart a previously stopped sandbox. The VM reboots using the persisted configuration.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Name of a stopped sandbox |

**Returns**

| Type | Description |
| --- | --- |
| [`Sandbox`](https://docs.microsandbox.dev/sdk/typescript/sandbox#instance-methods) | Running sandbox |

---

#### [Sandbox.startDetached()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandbox-startdetached)  

```
static startDetached(name: string): Promise<Sandbox>
```

Restart a stopped sandbox in detached mode.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Name of a stopped sandbox |

**Returns**

| Type | Description |
| --- | --- |
| [`Sandbox`](https://docs.microsandbox.dev/sdk/typescript/sandbox#instance-methods) | Running sandbox |

---

## [​Instance properties](https://docs.microsandbox.dev/sdk/typescript/sandbox\#instance-properties)  

---

#### [name​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#name)  

```
readonly name: string
```

Sandbox name.

---

#### [config​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#config)  

```
readonly config: Readonly<SandboxConfig>
```

The frozen configuration the sandbox was built with.

---

#### [ownsLifecycle​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#ownslifecycle)  

```
readonly ownsLifecycle: boolean
```

Whether this handle owns the sandbox lifecycle. `true` in attached mode (the auto-disposer will stop the sandbox), `false` in detached mode.

---

## [Instance methods​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#instance-methods)  

---

#### [detach()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#detach)  

```
detach(): Promise<void>
```

Release the handle without stopping the sandbox. Reconnect later with [`Sandbox.get()`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxget).

---

#### [drain()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#drain)  

```
drain(): Promise<void>
```

Start a graceful drain. Existing commands run to completion, new `exec` calls are rejected.

---

#### [fs()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#fs)  

```
fs(): SandboxFs
```

Get a filesystem handle for reading and writing files inside the running sandbox. See [Filesystem](https://docs.microsandbox.dev/sdk/typescript/filesystem) for the full API.**Returns**

| Type | Description |
| --- | --- |
| [`SandboxFs`](https://docs.microsandbox.dev/sdk/typescript/filesystem) | Filesystem handle |

---

#### [kill()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#kill) 

```
kill(): Promise<void>
```

Force-terminate the sandbox immediately. No graceful shutdown.

---

#### [metrics()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#metrics)  

```
metrics(): Promise<SandboxMetrics>
```

Get a point-in-time snapshot of the sandbox’s resource usage.**Returns**

| Type | Description |
| --- | --- |
| [`SandboxMetrics`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxmetrics) | CPU, memory, disk, network metrics |

---

#### [metricsStream()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#metricsstream)  

```
metricsStream(intervalMs: number): Promise<MetricsStream>
```

Stream resource metrics at a regular interval. The returned stream supports both `recv()` and `for await...of`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| intervalMs | `number` | Milliseconds between metric snapshots |

**Returns**

| Type | Description |
| --- | --- |
| [`MetricsStream`](https://docs.microsandbox.dev/sdk/typescript/sandbox#metricsstream) | Async stream of metrics |

---

#### [logs()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#logs)  

```
logs(opts?: LogReadOptions): Promise<LogEntry[]>
```

Read captured output from the sandbox’s `exec.log`. Backed by an on-disk JSON Lines file the runtime writes via the relay tap. Works on running and stopped sandboxes alike — there is no protocol traffic. The same method is available on [`SandboxHandle`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxhandle) for callers that don’t want to start the sandbox first.The default sources are `"stdout"`, `"stderr"`, and `"output"` (PTY-merged). Pass `"system"` to also include synthetic lifecycle markers and runtime/kernel diagnostic lines.

```
import { Sandbox } from "microsandbox";

const handle = await Sandbox.get("web");

// Default — all user-program output, regardless of pipe/pty mode
const entries = await handle.logs();

for (const e of entries) {
  const source =
    e.source === "stdout" ? "OUT" :
    e.source === "stderr" ? "ERR" :
    e.source === "output" ? "PTY" :
    "SYS";

  console.log(
    `[${e.timestamp.toISOString()}] ${source} ${e.sessionId}: ${e.text().trimEnd()}`
  );
}

// Filtered: last 50 entries from the past hour, including system lines
const recent = await handle.logs({
  tail: 50,
  since: new Date(Date.now() - 60 * 60 * 1000),
  sources: ["stdout", "stderr", "output", "system"],
});
```

**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| opts | [`LogReadOptions`](https://docs.microsandbox.dev/sdk/typescript/sandbox#logreadoptions)`?` | Filters: `tail`, `since`, `until`, `sources`. Omit for the default user-program sources. |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`LogEntry`](https://docs.microsandbox.dev/sdk/typescript/sandbox#logentry)`[]>` | Matching entries in chronological order |

---

#### [removePersisted()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#removepersisted)  

```
removePersisted(): Promise<void>
```

Remove the sandbox and all its persisted state from disk.

---

#### [stop()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#stop)  

```
stop(): Promise<void>
```

Gracefully shut down the sandbox.

---

#### [stopAndWait()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#stopandwait)  

```
stopAndWait(): Promise<ExitStatus>
```

Stop the sandbox and wait for the exit status.**Returns**

| Type | Description |
| --- | --- |
| [`ExitStatus`](https://docs.microsandbox.dev/sdk/typescript/execution#exitstatus) | Exit code and success flag |

---

#### [wait()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#wait)  

```
wait(): Promise<ExitStatus>
```

Block until the sandbox exits on its own.**Returns**

| Type | Description |
| --- | --- |
| [`ExitStatus`](https://docs.microsandbox.dev/sdk/typescript/execution#exitstatus) | Exit code and success flag |

---

#### [\[Symbol.asyncDispose\]()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#symbol-asyncdispose)  

```
[Symbol.asyncDispose](): Promise<void>
```

Implements `AsyncDisposable` so the sandbox can be used with `await using`. When the binding goes out of scope, the sandbox is stopped (best-effort) — but only if `ownsLifecycle` is `true`.

---

## [PatchBuilder​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#patchbuilder)  

Fluent builder for the ordered list of pre-boot rootfs patches. Used in `SandboxBuilder.patch(p => p...)`. Each method appends one operation; calls are chainable. By default a method that targets a path already present in the image errors at boot; pass `{ replace: true }` on the operation to allow overwriting. `mkdir` and `remove` are idempotent.See [Patches](https://docs.microsandbox.dev/sandboxes/customize#patches) for conceptual context.

---

#### [append()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#append)  

```
append(path: string, content: string): this
```

Append `content` to an existing file at `path`. If the file lives in a lower image layer, it’s copied up first.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |
| content | `string` | Text to append |

---

#### [​copyDir()](https://docs.microsandbox.dev/sdk/typescript/sandbox\#copydir)  

```
copyDir(src: string, dst: string, opts?: { replace?: boolean }): this
```

Recursively copy a host directory at `src` into the guest rootfs at `dst`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| src | `string` | Host source directory |
| dst | `string` | Absolute destination path inside the guest |
| opts.replace | `boolean` | When `true`, overwrite an existing path at `dst` |

* * *

#### [copyFile()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#copyfile)  

```
copyFile(
  src: string,
  dst: string,
  opts?: { mode?: number; replace?: boolean },
): this
```

Copy a single host file at `src` into the guest rootfs at `dst`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| src | `string` | Host source file |
| dst | `string` | Absolute destination path inside the guest |
| opts.mode | `number` | File mode, e.g. `0o644`. Omit to keep the source mode |
| opts.replace | `boolean` | When `true`, overwrite an existing path at `dst` |

---

#### [file()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#file)  

```
file(
  path: string,
  content: Buffer,
  opts?: { mode?: number; replace?: boolean },
): this
```

Write raw bytes at `path`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |
| content | `Buffer` | Raw byte content |
| opts.mode | `number` | File mode, e.g. `0o644` |
| opts.replace | `boolean` | When `true`, overwrite an existing path |

---

#### [mkdir()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#mkdir)  

```
mkdir(path: string, opts?: { mode?: number }): this
```

Create a directory at `path`. Idempotent: a no-op if the directory already exists.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |
| opts.mode | `number` | Directory mode, e.g. `0o755` |

---

#### [remove()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#remove)  
```
remove(path: string): this
```

Delete a file or directory at `path`. Idempotent: a no-op if the path doesn’t exist.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |

---

#### [symlink()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#symlink)  

```
symlink(target: string, link: string, opts?: { replace?: boolean }): this
```

Create a symlink at `link` pointing to `target`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| target | `string` | What the symlink points to (literal symlink target text) |
| link | `string` | Absolute path of the symlink itself |
| opts.replace | `boolean` | When `true`, overwrite an existing path at `link` |

---

#### [text()​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#text)  

```
text(
  path: string,
  content: string,
  opts?: { mode?: number; replace?: boolean },
): this
```

Write UTF-8 text content at `path`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |
| content | `string` | Text content |
| opts.mode | `number` | File mode, e.g. `0o644` |
| opts.replace | `boolean` | When `true`, overwrite an existing path |

---

## [​Types](https://docs.microsandbox.dev/sdk/typescript/sandbox\#types)  

### [SandboxBuilder​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandboxbuilder)  

Fluent configuration builder returned by `Sandbox.builder(name)`. Every setter returns the same builder so calls can be chained.

| Method | Description |
| --- | --- |
| `image(src)` | OCI image (`"alpine"`), local rootfs path, or a `RootfsSource`. **Required.** |
| `cpus(n)` | Virtual CPUs |
| `memory(mib)` | Guest memory in MiB |
| `logLevel(level)` | Override log verbosity |
| `quietLogs()` | Suppress log output |
| `workdir(path)` | Default working directory for commands |
| `shell(shell)` | Shell binary used by `sandbox.shell(...)` |
| `entrypoint(iter)` | Override the image’s stored ENTRYPOINT. Consulted by `msb exec` / `msb run` (CLI command resolution), **not** by `sandbox.exec` / `sandbox.shell` — those pass `cmd` literally |
| `init(cmd, args?)` | Hand off PID 1 to `cmd` (absolute path or `"auto"`) after agentd setup. See [Custom init system](https://docs.microsandbox.dev/sandboxes/customize#custom-init-system) |
| `initWith(cmd, i => ...)` | Like `init` but with a closure-builder for argv and env (`.arg`, `.args`, `.env`, `.envs`) |
| `hostname(name)` | Guest hostname |
| `user(user)` | Default guest user |
| `pullPolicy(policy)` | Image pull behavior |
| `libkrunfwPath(path)` | Override the bundled libkrunfw shared library |
| `env(key, value)` | Add a single env var |
| `envs(record | iter)` | Add many env vars |
| `script(name, content)` | Mount a script at `/.msb/scripts/<name>` |
| `scripts(record | iter)` | Mount many scripts |
| `replace()` | Replace any existing sandbox with the same name (10s SIGTERM grace, then SIGKILL) |
| `replaceWithGrace(graceMs)` | Same as `replace()` with a custom SIGTERM grace in milliseconds. `0` skips SIGTERM. Implies `replace()` |
| `maxDuration(secs)` | Maximum sandbox lifetime |
| `idleTimeout(secs)` | Stop the sandbox after this many idle seconds |
| `volume(guestPath, m => ...)` | Mount a volume — see [Volumes](https://docs.microsandbox.dev/sdk/typescript/volumes) |
| `patch(p => ...)` | Modify the rootfs before boot — see [Snapshots](https://docs.microsandbox.dev/sdk/typescript/snapshots) |
| `addPatch(patch)` | Append a pre-built `Patch` |
| `registry(r => r.auth(...).insecure().caCertsPath(...))` | Configure the OCI registry |
| `port(host, guest)` | Publish a TCP port |
| `portUdp(host, guest)` | Publish a UDP port |
| `disableNetwork()` | Disable networking entirely |
| `network(n => ...)` | Configure DNS / TLS / policy / secrets — see [Networking](https://docs.microsandbox.dev/sdk/typescript/networking) |
| `secret(s => ...)` | Add a secret via [`SecretBuilder`](https://docs.microsandbox.dev/sdk/typescript/secrets#secretbuilder) |
| `secretEnv(envVar, value, allowedHost)` | Auto-placeholder shorthand. Generates `$MSB_<ENV_VAR>`. |
| `build(): Promise<SandboxConfig>` | Materialize without booting |
| `create(): Promise<Sandbox>` | Build and boot in attached mode |
| `createDetached(): Promise<Sandbox>` | Build and boot in detached mode |
| `createWithPullProgress(): Promise<PullProgressCreate>` | Build and boot in attached mode while streaming image pull progress |
| `createDetachedWithPullProgress(): Promise<PullProgressCreate>` | Build and boot in detached mode while streaming image pull progress |

### [LogLevel​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#loglevel)  

Sandbox process log verbosity.

| Value | Description |
| --- | --- |
| `'debug'` | Debug and higher |
| `'error'` | Errors only |
| `'info'` | Info and higher |
| `'trace'` | Most verbose - all diagnostic output |
| `'warn'` | Warnings and errors only |

### [LogEntry​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#logentry)  

A class wrapping one captured log entry. Returned by [`logs()`](https://docs.microsandbox.dev/sdk/typescript/sandbox#logs).

| Property / Method | Type | Description |
| --- | --- | --- |
| timestamp | `Date` | Wall-clock capture time on the host |
| source | [`LogSource`](https://docs.microsandbox.dev/sdk/typescript/sandbox#logsource) | Where the chunk came from |
| sessionId | `number | null` | Relay-monotonic session id; `null` for `"system"` entries |
| data | `Uint8Array` | The chunk’s bytes (UTF-8 lossy decoded by default) |
| `text()` | `string` | Convenience: UTF-8 decode of `data` (lossy — invalid bytes are replaced) |

### [​LogReadOptions](https://docs.microsandbox.dev/sdk/typescript/sandbox\#logreadoptions)  

Filters passed to [`logs()`](https://docs.microsandbox.dev/sdk/typescript/sandbox#logs). All fields optional. Omit the argument entirely for the default sources (`stdout` \+ `stderr` \+ `output`).

| Field | Type | Description |
| --- | --- | --- |
| tail | `number?` | Show only the last N entries after other filters apply |
| since | `Date?` | Inclusive lower bound on entry timestamp |
| until | `Date?` | Exclusive upper bound on entry timestamp |
| sources | [`LogSource`](https://docs.microsandbox.dev/sdk/typescript/sandbox#logsource)`[]?` | Sources to include. Omit = `["stdout", "stderr", "output"]`. Add `"system"` to merge runtime/kernel diagnostics. |

### [LogSource​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#logsource)  

Tag indicating where a captured log entry came from. String literal type:

```
type LogSource = "stdout" | "stderr" | "output" | "system";
```

| Value | Description |
| --- | --- |
| `"stdout"` | Captured from a session’s stdout (pipe mode — streams stayed separated) |
| `"stderr"` | Captured from a session’s stderr (pipe mode) |
| `"output"` | Captured from a session running in PTY mode. PTY allocation merges stdout and stderr at the kernel level inside the guest, so they arrive as a single stream — tagged `"output"` rather than mislabelled as `"stdout"`. |
| `"system"` | Synthetic entry: lifecycle markers in `exec.log` plus runtime/kernel diagnostic lines merged in at read time when `"system"` is requested. |

### [​MetricsStream](https://docs.microsandbox.dev/sdk/typescript/sandbox\#metricsstream-2)  

Async stream for receiving periodic metrics snapshots.

| Method | Returns | Description |
| --- | --- | --- |
| `[Symbol.asyncIterator]` | `AsyncIterator<` [`SandboxMetrics`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxmetrics)`>` | Use with `for await...of` |
| `recv()` | `Promise<` [`SandboxMetrics`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxmetrics)` | null>` | Receive next snapshot. Returns `null` when the stream ends. |
| `[Symbol.asyncDispose]()` | `Promise<void>` | Stop iterating; safe to use with `await using`. |

### [PullPolicy​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#pullpolicy)  

Controls when the SDK fetches an OCI image from the registry.

| Value | Description |
| --- | --- |
| `'always'` | Pull the image every time, even if cached locally |
| `'if-missing'` | Pull only if the image is not already cached. This is the default. |
| `'never'` | Never pull; fail if the image is not cached locally |

### [PullProgress​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#pullprogress)  

Image pull and materialize progress event emitted by [`PullProgressCreate`](https://docs.microsandbox.dev/sdk/typescript/sandbox#pullprogresscreate). A discriminated union. Narrow on `kind` to access variant-specific fields:

```
const creation = await Sandbox.builder("demo")
  .image("alpine")
  .createWithPullProgress();

for await (const ev of creation) {
  if (ev.kind === "layerDownloadProgress") {
    console.log(`${ev.layerIndex}: ${ev.downloadedBytes}/${ev.totalBytes}`);
  }
}

const sandbox = await creation.awaitSandbox();
```

| `kind` value | Additional fields |
| --- | --- |
| `'resolving'` | `reference: string` |
| `'resolved'` | `reference: string`, `manifestDigest: string`, `layerCount: number`, `totalDownloadBytes?: number` |
| `'layerDownloadProgress'` | `layerIndex: number`, `digest: string`, `downloadedBytes: number`, `totalBytes?: number` |
| `'layerDownloadComplete'` | `layerIndex: number`, `digest: string`, `downloadedBytes: number` |
| `'layerDownloadVerifying'` | `layerIndex: number`, `digest: string` |
| `'layerMaterializeStarted'` | `layerIndex: number`, `diffId: string` |
| `'layerMaterializeProgress'` | `layerIndex: number`, `bytesRead: number`, `totalBytes: number` |
| `'layerMaterializeWriting'` | `layerIndex: number` |
| `'layerMaterializeComplete'` | `layerIndex: number`, `diffId: string` |
| `'stitchMergingTrees'` | `layerCount: number` |
| `'stitchWritingFsmeta'` | (none) |
| `'stitchWritingVmdk'` | (none) |
| `'stitchComplete'` | (none) |
| `'complete'` | `reference: string`, `layerCount: number` |

`totalDownloadBytes` and `totalBytes` on the `'resolved'` / `'layerDownloadProgress'` variants may be absent if the manifest omits sizes.

### [​PullProgressCreate](https://docs.microsandbox.dev/sdk/typescript/sandbox\#pullprogresscreate)  

Async iterable creation handle returned by `Sandbox.builder(name).createWithPullProgress()` and `Sandbox.builder(name).createDetachedWithPullProgress()`. Yields [`PullProgress`](https://docs.microsandbox.dev/sdk/typescript/sandbox#pullprogress) events as the image is resolved, downloaded, and materialized. Call `awaitSandbox()` after iteration to obtain the live sandbox.

| Method | Returns | Description |
| --- | --- | --- |
| \[Symbol.asyncIterator\] | `AsyncGenerator<` [`PullProgress`](https://docs.microsandbox.dev/sdk/typescript/sandbox#pullprogress)`>` | Use with `for await...of` |
| progress.recv() | `Promise<` [`PullProgress`](https://docs.microsandbox.dev/sdk/typescript/sandbox#pullprogress)` | null>` | Receive next event. Returns `null` when the stream ends. |
| awaitSandbox() | `Promise<` [`Sandbox`](https://docs.microsandbox.dev/sdk/typescript/sandbox#instance-methods)`>` | Resolve the underlying creation task and return the running sandbox. Single-shot: a second call throws an already-consumed error. |

### [SandboxConfig​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandboxconfig)  

Frozen configuration object — produced by `SandboxBuilder.build()` and exposed as the `config` property on a `Sandbox`. You generally should not construct this by hand; use the builder.

| Field | Type | Description |
| --- | --- | --- |
| name | `string` | Sandbox name |
| image | `RootfsSource` | OCI / bind / disk discriminated union |
| cpus | `number | null` | Virtual CPUs |
| memoryMib | `number | null` | Guest memory in MiB |
| logLevel | `LogLevel | null` | Log verbosity |
| quietLogs | `boolean` | Suppress log output |
| workdir | `string | null` | Default working directory |
| shell | `string | null` | Shell binary |
| entrypoint | `string[] | null` | Override image entrypoint |
| cmd | `string[] | null` | Override image cmd |
| hostname | `string | null` | Guest hostname |
| user | `string | null` | Default guest user |
| libkrunfwPath | `string | null` | Custom libkrunfw path |
| env | `Array<readonly [string, string]>` | Environment variables |
| scripts | `Array<readonly [string, string]>` | Named scripts |
| mounts | `VolumeMount[]` | Volume mounts |
| patches | `Patch[]` | Rootfs modifications applied before boot |
| pullPolicy | `PullPolicy | null` | Image pull behavior |
| replace | `boolean` | Replace existing sandbox with same name |
| replaceWithGraceMs | `number` | Milliseconds to wait after `SIGTERM` before escalating to `SIGKILL` (default `10000`; `0` skips `SIGTERM`) |
| maxDurationSecs | `number | null` | Maximum sandbox lifetime |
| idleTimeoutSecs | `number | null` | Stop after idle time |
| portsTcp | `Array<readonly [number, number]>` | TCP host→guest mappings |
| portsUdp | `Array<readonly [number, number]>` | UDP host→guest mappings |
| registry | `RegistryConfig | null` | Registry connection settings |
| network | `NetworkConfig | null` | Network configuration |
| disableNetwork | `boolean` | Disable networking entirely |
| secrets | `SecretEntry[]` | Secret entries (top-level) |

### [SandboxHandle​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandboxhandle)  

A lightweight handle to an existing sandbox (running or stopped). Obtained via [`Sandbox.get()`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxget) or [`Sandbox.list()`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxlist).Handles from `Sandbox.get(name)` are **live** — they expose lifecycle methods (`start`, `stop`, `kill`, `connect`, etc). Handles in the array returned by `Sandbox.list()` are **read-only**: calling lifecycle methods on them throws. Use `Sandbox.get(name)` to upgrade to a live handle.

| Property / Method | Type | Description |
| --- | --- | --- |
| name | `string` | Sandbox name |
| status | [`SandboxStatus`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxstatus) | Current status |
| configJson | `string` | Raw JSON configuration |
| createdAt | `Date | null` | Creation timestamp |
| updatedAt | `Date | null` | Last update timestamp |
| metrics() | `Promise<` [`SandboxMetrics`](https://docs.microsandbox.dev/sdk/typescript/sandbox#sandboxmetrics)`>` | Point-in-time resource metrics |
| logs() | `Promise<` [`LogEntry`](https://docs.microsandbox.dev/sdk/typescript/sandbox#logentry)`[]>` | Read captured `exec.log` (works without starting) |
| start() | `Promise<` [`Sandbox`](https://docs.microsandbox.dev/sdk/typescript/sandbox#instance-methods)`>` | Start in attached mode |
| startDetached() | `Promise<` [`Sandbox`](https://docs.microsandbox.dev/sdk/typescript/sandbox#instance-methods)`>` | Start in detached mode |
| connect() | `Promise<` [`Sandbox`](https://docs.microsandbox.dev/sdk/typescript/sandbox#instance-methods)`>` | Connect to a running sandbox without taking ownership |
| stop() | `Promise<void>` | Graceful shutdown |
| kill() | `Promise<void>` | Force terminate |
| remove() | `Promise<void>` | Delete sandbox and state |

### [​SandboxMetrics](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandboxmetrics)  

Point-in-time resource usage snapshot.

| Field | Type | Description |
| --- | --- | --- |
| cpuPercent | `number` | CPU usage as a percentage |
| diskReadBytes | `number` | Total bytes read from disk since boot |
| diskWriteBytes | `number` | Total bytes written to disk since boot |
| memoryBytes | `number` | Current memory usage in bytes |
| memoryLimitBytes | `number` | Memory limit in bytes |
| netRxBytes | `number` | Total bytes received over the network since boot |
| netTxBytes | `number` | Total bytes sent over the network since boot |
| timestamp | `Date` | When this measurement was taken |
| uptimeMs | `number` | Time since the sandbox was created (ms) |

### [SandboxStatus​](https://docs.microsandbox.dev/sdk/typescript/sandbox\#sandboxstatus)  

| Value | Description |
| --- | --- |
| `'crashed'` | VM exited unexpectedly |
| `'draining'` | Graceful shutdown in progress |
| `'running'` | Guest agent is ready |
| `'stopped'` | VM shut down; can be restarted |
