---
url: "https://docs.microsandbox.dev/sdk/typescript/execution"
title: "Execution - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/execution#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

Search...

Ctrl KAsk AI

Search...

Navigation

TypeScript SDK

Execution

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

See [Commands](https://docs.microsandbox.dev/sandboxes/commands) for usage examples.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#attach)  attach()

```
attach(cmd: string, args?: Iterable<string>): Promise<number>
```

Bridge your terminal directly to a process inside the sandbox for a fully interactive PTY session. Press `Ctrl+]` (or configured detach keys) to disconnect without stopping the process.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| cmd | `string` | Command to run |
| args? | `Iterable<string>` | Command arguments |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<number>` | Exit code of the process |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#attachshell)  attachShell()

```
attachShell(): Promise<number>
```

Attach to the sandbox’s default shell.**Returns**

| Type | Description |
| --- | --- |
| `Promise<number>` | Exit code |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#attachwith)  attachWith()

```
attachWith(
  cmd: string,
  configure: (b: AttachOptionsBuilder) => AttachOptionsBuilder,
): Promise<number>
```

Interactive PTY attach with options for environment variables, working directory, user, and custom detach keys. Configure via the builder callback.

```
const code = await sandbox.attachWith("bash", (a) =>
  a.cwd("/app")
    .env("EDITOR", "vim")
    .detachKeys("ctrl-]"),
);
```

**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| cmd | `string` | Command to run |
| configure | `(b: AttachOptionsBuilder) => AttachOptionsBuilder` | Builder callback — see [`AttachOptionsBuilder`](https://docs.microsandbox.dev/sdk/typescript/execution#attachoptionsbuilder) |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<number>` | Exit code |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#exec)  exec()

```
exec(cmd: string, args?: Iterable<string>): Promise<ExecOutput>
```

Run a command inside the sandbox and wait for it to complete. Collects all stdout and stderr into memory and returns them along with the exit code. For long-running processes or large output, use [`execStream()`](https://docs.microsandbox.dev/sdk/typescript/execution#execstream) instead.

```
const result = await sandbox.exec("python3", ["-c", "print(1 + 1)"]);
console.log(result.stdout()); // "2\n"
console.log(result.code);     // 0
```

**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| cmd | `string` | Command to execute (e.g. `"python"`, `"/usr/bin/node"`) |
| args? | `Iterable<string>` | Command arguments (e.g. `["-c", "print('hello')"]`) |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`ExecOutput`](https://docs.microsandbox.dev/sdk/typescript/execution#execoutput)`>` | Collected stdout, stderr, and exit status |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execstream)  execStream()

```
execStream(cmd: string, args?: Iterable<string>): Promise<ExecHandle>
```

Run a command with streaming output. Returns a handle that emits stdout, stderr, and exit events as they happen, rather than buffering everything.

```
const handle = await sandbox.execStream("tail", ["-f", "/var/log/app.log"]);
for await (const event of handle) {
  if (event.kind === "stdout") process.stdout.write(event.data);
  if (event.kind === "exited") break;
}
```

**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| cmd | `string` | Command to execute |
| args? | `Iterable<string>` | Command arguments |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`ExecHandle`](https://docs.microsandbox.dev/sdk/typescript/execution#exechandle)`>` | Streaming handle for receiving events and controlling the process |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execstreamwith)  execStreamWith()

```
execStreamWith(
  cmd: string,
  configure: (b: ExecOptionsBuilder) => ExecOptionsBuilder,
): Promise<ExecHandle>
```

Streaming variant of [`execWith()`](https://docs.microsandbox.dev/sdk/typescript/execution#execwith) — same configuration via [`ExecOptionsBuilder`](https://docs.microsandbox.dev/sdk/typescript/execution#execoptionsbuilder), but returns an [`ExecHandle`](https://docs.microsandbox.dev/sdk/typescript/execution#exechandle).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execwith)  execWith()

```
execWith(
  cmd: string,
  configure: (b: ExecOptionsBuilder) => ExecOptionsBuilder,
): Promise<ExecOutput>
```

Run a command with per-execution overrides. Configure working directory, environment variables, timeout, stdin, TTY allocation, and rlimits via the builder callback. These overrides apply only to this execution and don’t change the sandbox’s defaults.

```
const out = await sandbox.execWith("python3", (e) =>
  e.args(["script.py"])
    .cwd("/app")
    .env("PYTHONPATH", "/app/lib")
    .timeout(30_000),
);
```

**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| cmd | `string` | Command to execute |
| configure | `(b: ExecOptionsBuilder) => ExecOptionsBuilder` | Builder callback — see [`ExecOptionsBuilder`](https://docs.microsandbox.dev/sdk/typescript/execution#execoptionsbuilder) |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`ExecOutput`](https://docs.microsandbox.dev/sdk/typescript/execution#execoutput)`>` | Collected stdout, stderr, and exit status |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#shell)  shell()

```
shell(script: string): Promise<ExecOutput>
```

Run a command through the sandbox’s configured shell (defaults to `/bin/sh`). Shell syntax like pipes, redirects, and `&&` chains works.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| script | `string` | Shell command string (e.g. `"ls -la /app && echo done"`) |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`ExecOutput`](https://docs.microsandbox.dev/sdk/typescript/execution#execoutput)`>` | Collected stdout, stderr, and exit status |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#shellstream)  shellStream()

```
shellStream(script: string): Promise<ExecHandle>
```

Shell command with streaming output.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| script | `string` | Shell command string |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`ExecHandle`](https://docs.microsandbox.dev/sdk/typescript/execution#exechandle)`>` | Streaming handle |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/execution\#types)  Types

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#attachoptionsbuilder)  AttachOptionsBuilder

Fluent builder used inside `Sandbox.attachWith(cmd, b => ...)`. Every setter returns the same builder so calls can be chained.

| Method | Description |
| --- | --- |
| `arg(s)` | Append a single argument |
| `args(iter)` | Append many arguments |
| `cwd(path)` | Working directory |
| `user(user)` | Guest user |
| `env(key, value)` | Add a single env var |
| `envs(record | iter)` | Add many env vars |
| `detachKeys(spec)` | Detach key sequence (e.g. `"ctrl-]"` or `"ctrl-p,ctrl-q"`) |
| `rlimit(resource, n)` | Set both soft and hard rlimit |
| `rlimitRange(resource, soft, hard)` | Set distinct soft/hard rlimits |
| `build()` | Produce an immutable [`AttachOptions`](https://docs.microsandbox.dev/sdk/typescript/execution#attachoptions) |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#attachoptions)  AttachOptions

The immutable object produced by `AttachOptionsBuilder.build()`.

| Field | Type | Description |
| --- | --- | --- |
| args | `readonly string[]` | Command arguments |
| cwd | `string | null` | Working directory |
| user | `string | null` | Guest user |
| env | `ReadonlyArray<readonly [string, string]>` | Environment variables |
| detachKeys | `string | null` | Detach key sequence |
| rlimits | `readonly Rlimit[]` | rlimits for the process |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execoptionsbuilder)  ExecOptionsBuilder

Fluent builder used inside `Sandbox.execWith(cmd, b => ...)`.

| Method | Description |
| --- | --- |
| `arg(s)` / `args(iter)` | Append arguments |
| `cwd(path)` | Working directory |
| `user(user)` | Guest user |
| `env(key, value)` / `envs(record | iter)` | Environment variables |
| `timeout(ms)` | Kill the process after this many milliseconds |
| `stdinNull()` | Stdin connected to `/dev/null` (default) |
| `stdinPipe()` | Open a writable stdin pipe — read it back with `ExecHandle.takeStdin()` |
| `stdinBytes(data)` | Pre-supply stdin (`Uint8Array | string`) |
| `tty(enabled)` | Allocate a pseudo-terminal |
| `rlimit(resource, n)` / `rlimitRange(resource, soft, hard)` | rlimits |
| `build()` | Produce an immutable [`ExecOptions`](https://docs.microsandbox.dev/sdk/typescript/execution#execoptions) |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execoptions)  ExecOptions

The immutable object produced by `ExecOptionsBuilder.build()`.

| Field | Type | Description |
| --- | --- | --- |
| args | `readonly string[]` | Command arguments |
| cwd | `string | null` | Working directory |
| user | `string | null` | Guest user |
| env | `ReadonlyArray<readonly [string, string]>` | Environment variables |
| timeoutMs | `number | null` | Timeout in milliseconds |
| stdin | `StdinMode` | `null`, `pipe`, or pre-supplied `bytes` |
| tty | `boolean` | TTY allocation |
| rlimits | `readonly Rlimit[]` | rlimits |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execevent)  ExecEvent

Discriminated union emitted by `ExecHandle`. The discriminator is `kind` (not `eventType`).

```
type ExecEvent =
  | { kind: "started"; pid: number }
  | { kind: "stdout"; data: Uint8Array }
  | { kind: "stderr"; data: Uint8Array }
  | { kind: "exited"; code: number };
```

| `kind` | Payload | Description |
| --- | --- | --- |
| `'started'` | `pid: number` | The process has started |
| `'stdout'` | `data: Uint8Array` | A chunk of stdout data |
| `'stderr'` | `data: Uint8Array` | A chunk of stderr data |
| `'exited'` | `code: number` | The process has exited |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#exechandle)  ExecHandle

A handle to a running streaming execution. `AsyncIterable<ExecEvent>` and `AsyncDisposable`.

| Property / Method | Type | Description |
| --- | --- | --- |
| `recv()` | `Promise<` [`ExecEvent`](https://docs.microsandbox.dev/sdk/typescript/execution#execevent)` | null>` | Receive the next event. Returns `null` when done. |
| `takeStdin()` | `Promise<` [`ExecSink`](https://docs.microsandbox.dev/sdk/typescript/execution#execsink)` | null>` | Take the stdin writer. Returns `null` after first call. |
| `wait()` | `Promise<` [`ExitStatus`](https://docs.microsandbox.dev/sdk/typescript/execution#exitstatus)`>` | Wait for the process to exit |
| `collect()` | `Promise<` [`ExecOutput`](https://docs.microsandbox.dev/sdk/typescript/execution#execoutput)`>` | Drain remaining output and wait |
| `signal(n)` | `Promise<void>` | Send a POSIX signal |
| `kill()` | `Promise<void>` | Send SIGKILL |
| `[Symbol.asyncIterator]()` | `AsyncIterator<` [`ExecEvent`](https://docs.microsandbox.dev/sdk/typescript/execution#execevent)`>` | Iterate events with `for await...of` |
| `[Symbol.asyncDispose]()` | `Promise<void>` | Best-effort kill on `await using` exit |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execoutput)  ExecOutput

The result of a completed command execution.

| Property / Method | Type | Description |
| --- | --- | --- |
| `code` | `number` (getter) | Exit code |
| `success` | `boolean` (getter) | `true` if code is `0` |
| `status` | [`ExitStatus`](https://docs.microsandbox.dev/sdk/typescript/execution#exitstatus) (getter) | Exit status object |
| `stdout()` | `string` | Collected stdout decoded as UTF-8 |
| `stderr()` | `string` | Collected stderr decoded as UTF-8 |
| `stdoutBytes()` | `Uint8Array` | Raw stdout bytes |
| `stderrBytes()` | `Uint8Array` | Raw stderr bytes |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#execsink)  ExecSink

Writer for sending data to a running process’s stdin.

| Method | Parameters | Description |
| --- | --- | --- |
| `write(data)` | `Uint8Array | string` | Write bytes to the process’s stdin |
| `close()` | - | Close stdin. The process sees EOF. |
| `[Symbol.asyncDispose]()` | - | Calls `close()` |

### [​](https://docs.microsandbox.dev/sdk/typescript/execution\#exitstatus)  ExitStatus

| Field | Type | Description |
| --- | --- | --- |
| code | `number` | Exit code. `0` typically means success. |
| success | `boolean` | `true` if code is `0` |

Was this page helpful?

YesNo

[Previous](https://docs.microsandbox.dev/sdk/typescript/sandbox) [FilesystemTypeScript SDK - Filesystem API reference\\
\\
Next](https://docs.microsandbox.dev/sdk/typescript/filesystem)

Ctrl+I

On this page

- [attach()](https://docs.microsandbox.dev/sdk/typescript/execution#attach)
- [attachShell()](https://docs.microsandbox.dev/sdk/typescript/execution#attachshell)
- [attachWith()](https://docs.microsandbox.dev/sdk/typescript/execution#attachwith)
- [exec()](https://docs.microsandbox.dev/sdk/typescript/execution#exec)
- [execStream()](https://docs.microsandbox.dev/sdk/typescript/execution#execstream)
- [execStreamWith()](https://docs.microsandbox.dev/sdk/typescript/execution#execstreamwith)
- [execWith()](https://docs.microsandbox.dev/sdk/typescript/execution#execwith)
- [shell()](https://docs.microsandbox.dev/sdk/typescript/execution#shell)
- [shellStream()](https://docs.microsandbox.dev/sdk/typescript/execution#shellstream)
- [Types](https://docs.microsandbox.dev/sdk/typescript/execution#types)
- [AttachOptionsBuilder](https://docs.microsandbox.dev/sdk/typescript/execution#attachoptionsbuilder)
- [AttachOptions](https://docs.microsandbox.dev/sdk/typescript/execution#attachoptions)
- [ExecOptionsBuilder](https://docs.microsandbox.dev/sdk/typescript/execution#execoptionsbuilder)
- [ExecOptions](https://docs.microsandbox.dev/sdk/typescript/execution#execoptions)
- [ExecEvent](https://docs.microsandbox.dev/sdk/typescript/execution#execevent)
- [ExecHandle](https://docs.microsandbox.dev/sdk/typescript/execution#exechandle)
- [ExecOutput](https://docs.microsandbox.dev/sdk/typescript/execution#execoutput)
- [ExecSink](https://docs.microsandbox.dev/sdk/typescript/execution#execsink)
- [ExitStatus](https://docs.microsandbox.dev/sdk/typescript/execution#exitstatus)

Assistant

Responses are generated using AI and may contain mistakes.