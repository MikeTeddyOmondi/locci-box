---
url: "https://docs.microsandbox.dev/sdk/typescript/filesystem"
title: "Filesystem - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/filesystem#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

Search...

Ctrl KAsk AI

Search...

Navigation

TypeScript SDK

Filesystem

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

See [Filesystem](https://docs.microsandbox.dev/sandboxes/filesystem) for usage examples and extensible backends.

## [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#sandboxfs)  SandboxFs

Filesystem handle for a running sandbox. Obtained via `sb.fs()`. All operations go through the same host-guest channel as command execution — no SSH, no network involved. For bulk file operations, consider using [volumes](https://docs.microsandbox.dev/sandboxes/volumes) instead.

```
const fs = sandbox.fs();

await fs.write("/tmp/config.json", '{"debug": true}');
const content = await fs.readToString("/tmp/config.json");
```

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#copy)  copy()

```
copy(from: string, to: string): Promise<void>
```

Copy a file within the sandbox.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| from | `string` | Source path |
| to | `string` | Destination path |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#copyfromhost)  copyFromHost()

```
copyFromHost(hostPath: string, guestPath: string): Promise<void>
```

Copy a file from the host machine into the sandbox. For transferring many files, consider a [bind-mounted volume](https://docs.microsandbox.dev/sandboxes/volumes) instead.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| hostPath | `string` | Path on the host filesystem |
| guestPath | `string` | Destination path inside the sandbox |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#copytohost)  copyToHost()

```
copyToHost(guestPath: string, hostPath: string): Promise<void>
```

Copy a file from the sandbox to the host machine.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| guestPath | `string` | Path inside the sandbox |
| hostPath | `string` | Destination path on the host |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#exists)  exists()

```
exists(path: string): Promise<boolean>
```

Check whether a path exists inside the sandbox.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<boolean>` | `true` if the path exists |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#list)  list()

```
list(path: string): Promise<FsEntry[]>
```

List the entries in a directory.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute directory path inside the guest |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`FsEntry`](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsentry)`[]>` | Directory entries |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#mkdir)  mkdir()

```
mkdir(path: string): Promise<void>
```

Create a directory. Parent directories must already exist.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute directory path |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#read)  read()

```
read(path: string): Promise<Uint8Array>
```

Read the entire contents of a file as raw bytes.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest (e.g. `"/app/config.json"`) |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<Uint8Array>` | File contents as raw bytes |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#readstream)  readStream()

```
readStream(path: string): Promise<FsReadStream>
```

Open a streaming reader for a file. Data is transferred in chunks of approximately 3 MiB each. Use this for files too large to fit in memory.

```
for await (const chunk of await fs.readStream("/var/log/syslog")) {
  process.stdout.write(chunk); // chunk is a Uint8Array
}
```

**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`FsReadStream`](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsreadstream)`>` | Async stream that yields chunks of file data |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#readtostring)  readToString()

```
readToString(path: string): Promise<string>
```

Read the entire contents of a file and decode as UTF-8.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<string>` | File contents as a string |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#remove)  remove()

```
remove(path: string): Promise<void>
```

Remove a file.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute file path |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#removedir)  removeDir()

```
removeDir(path: string): Promise<void>
```

Remove a directory.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute directory path |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#rename)  rename()

```
rename(from: string, to: string): Promise<void>
```

Rename or move a file or directory within the sandbox.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| from | `string` | Current path |
| to | `string` | New path |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#stat)  stat()

```
stat(path: string): Promise<FsMetadata>
```

Get detailed metadata for a file or directory.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`FsMetadata`](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsmetadata)`>` | File metadata |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#write)  write()

```
write(path: string, data: Uint8Array | string): Promise<void>
```

Write content to a file, creating it if it doesn’t exist and overwriting if it does. Parent directories must already exist. `string` payloads are encoded as UTF-8.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |
| data | `Uint8Array | string` | File content |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#writestream)  writeStream()

```
writeStream(path: string): Promise<FsWriteSink>
```

Open a streaming writer for a file. Use for files too large to hold in memory; pair with `await using` so the sink closes itself.

```
await using sink = await fs.writeStream("/tmp/big.bin");
await sink.write(new Uint8Array(1 << 20));
```

**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | Absolute path inside the guest |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`FsWriteSink`](https://docs.microsandbox.dev/sdk/typescript/filesystem#fswritesink)`>` | Streaming writer |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#types)  Types

### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#fsentry)  FsEntry

Metadata for a single directory entry, returned by [`list()`](https://docs.microsandbox.dev/sdk/typescript/filesystem#list).

| Field | Type | Description |
| --- | --- | --- |
| path | `string` | File path |
| kind | [`FsEntryKind`](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsentrykind) | Type of entry |
| size | `number` | File size in bytes |
| mode | `number` | Unix permission bits |
| modified | `Date | null` | Last modified timestamp |

### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#fsentrykind)  FsEntryKind

```
type FsEntryKind = "file" | "directory" | "symlink" | "other";
```

| Value | Description |
| --- | --- |
| `'file'` | Regular file |
| `'directory'` | Directory |
| `'symlink'` | Symbolic link |
| `'other'` | Other entry type |

### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#fsmetadata)  FsMetadata

Detailed file metadata, returned by [`stat()`](https://docs.microsandbox.dev/sdk/typescript/filesystem#stat).

| Field | Type | Description |
| --- | --- | --- |
| kind | [`FsEntryKind`](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsentrykind) | Type of entry |
| size | `number` | File size in bytes |
| mode | `number` | Unix permission bits |
| readonly | `boolean` | Whether the file is read-only |
| modified | `Date | null` | Last modified timestamp |
| created | `Date | null` | Creation timestamp |

### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#fsreadstream)  FsReadStream

Async stream for reading a file in chunks. Obtained via [`readStream()`](https://docs.microsandbox.dev/sdk/typescript/filesystem#readstream). `AsyncIterable<Uint8Array>` and `AsyncDisposable`.

| Method | Returns | Description |
| --- | --- | --- |
| `recv()` | `Promise<Uint8Array | null>` | Receive the next chunk. Returns `null` when the file has been fully read. |
| `collect()` | `Promise<Uint8Array>` | Drain the stream into a single buffer |
| `[Symbol.asyncIterator]()` | `AsyncIterator<Uint8Array>` | Use with `for await...of` |
| `[Symbol.asyncDispose]()` | `Promise<void>` | Stop reading; safe to use with `await using` |

### [​](https://docs.microsandbox.dev/sdk/typescript/filesystem\#fswritesink)  FsWriteSink

Streaming writer returned by [`writeStream()`](https://docs.microsandbox.dev/sdk/typescript/filesystem#writestream). `AsyncDisposable`.

| Method | Parameters | Description |
| --- | --- | --- |
| `write(data)` | `Uint8Array | string` | Append a chunk |
| `close()` | - | Flush and close. Idempotent. |
| `[Symbol.asyncDispose]()` | - | Calls `close()` |

Was this page helpful?

YesNo

[Previous](https://docs.microsandbox.dev/sdk/typescript/execution) [VolumesTypeScript SDK - Volume API reference\\
\\
Next](https://docs.microsandbox.dev/sdk/typescript/volumes)

Ctrl+I

On this page

- [SandboxFs](https://docs.microsandbox.dev/sdk/typescript/filesystem#sandboxfs)
- [copy()](https://docs.microsandbox.dev/sdk/typescript/filesystem#copy)
- [copyFromHost()](https://docs.microsandbox.dev/sdk/typescript/filesystem#copyfromhost)
- [copyToHost()](https://docs.microsandbox.dev/sdk/typescript/filesystem#copytohost)
- [exists()](https://docs.microsandbox.dev/sdk/typescript/filesystem#exists)
- [list()](https://docs.microsandbox.dev/sdk/typescript/filesystem#list)
- [mkdir()](https://docs.microsandbox.dev/sdk/typescript/filesystem#mkdir)
- [read()](https://docs.microsandbox.dev/sdk/typescript/filesystem#read)
- [readStream()](https://docs.microsandbox.dev/sdk/typescript/filesystem#readstream)
- [readToString()](https://docs.microsandbox.dev/sdk/typescript/filesystem#readtostring)
- [remove()](https://docs.microsandbox.dev/sdk/typescript/filesystem#remove)
- [removeDir()](https://docs.microsandbox.dev/sdk/typescript/filesystem#removedir)
- [rename()](https://docs.microsandbox.dev/sdk/typescript/filesystem#rename)
- [stat()](https://docs.microsandbox.dev/sdk/typescript/filesystem#stat)
- [write()](https://docs.microsandbox.dev/sdk/typescript/filesystem#write)
- [writeStream()](https://docs.microsandbox.dev/sdk/typescript/filesystem#writestream)
- [Types](https://docs.microsandbox.dev/sdk/typescript/filesystem#types)
- [FsEntry](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsentry)
- [FsEntryKind](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsentrykind)
- [FsMetadata](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsmetadata)
- [FsReadStream](https://docs.microsandbox.dev/sdk/typescript/filesystem#fsreadstream)
- [FsWriteSink](https://docs.microsandbox.dev/sdk/typescript/filesystem#fswritesink)

Assistant

Responses are generated using AI and may contain mistakes.