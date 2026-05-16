---
url: "https://docs.microsandbox.dev/sdk/typescript/snapshots"
title: "Snapshots - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/snapshots#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

Search...

Ctrl KAsk AI

Search...

Navigation

TypeScript SDK

Snapshots

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

Disk-only snapshots of a stopped sandbox. See [Snapshots](https://docs.microsandbox.dev/sandboxes/snapshots) for concepts and walkthroughs; this page is the TypeScript SDK reference.

```
import { Sandbox, Snapshot, SnapshotHandle } from "microsandbox";
import type { ExportOpts, SnapshotVerifyReport } from "microsandbox";
```

Snapshots are **disk-only and stopped-only**. Live snapshots and qcow2 backing chains are tracked as future work.

## [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#sandboxbuilder)  SandboxBuilder

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#fromsnapshot)  fromSnapshot()

```
fromSnapshot(pathOrName: string): SandboxBuilder
```

Boot a fresh sandbox from a snapshot artifact. Mutually exclusive with [`image()`](https://docs.microsandbox.dev/sdk/typescript/sandbox#image) — the snapshot already pins the image.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| pathOrName | `string` | Bare name (resolved under `~/.microsandbox/snapshots/`) or filesystem path to an artifact directory |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#sandboxhandle-methods)  SandboxHandle methods

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot)  snapshot()

```
snapshot(name: string): Promise<Snapshot>
```

Snapshot this (stopped) sandbox under a bare name in the default snapshots directory (`~/.microsandbox/snapshots/<name>/`). For an explicit filesystem destination, see [`snapshotTo()`](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshotto).**Errors**

- `SnapshotSandboxRunning` — the sandbox is not stopped
- `SnapshotAlreadyExists` — destination exists (use the builder with `.force()` to overwrite)

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshotto)  snapshotTo()

```
snapshotTo(path: string): Promise<Snapshot>
```

Snapshot this (stopped) sandbox to an explicit filesystem path.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-instance)  Snapshot (instance)

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#path)  path

```
readonly path: string
```

Path to the artifact directory.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#digest)  digest

```
readonly digest: string
```

Canonical content digest (`sha256:hex`) over the manifest bytes. The snapshot’s identity.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#sizebytes)  sizeBytes

```
readonly sizeBytes: bigint
```

Apparent size of the captured upper layer in bytes (the ext4 virtual size, sparse on disk).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#imageref)  imageRef

```
readonly imageRef: string
```

Image reference the snapshot was taken from.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#imagemanifestdigest)  imageManifestDigest

```
readonly imageManifestDigest: string
```

OCI manifest digest of the pinned image.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#format)  format

```
readonly format: "raw" | "qcow2"
```

On-disk format of the upper layer. Always `"raw"` today.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#fstype)  fstype

```
readonly fstype: string
```

Filesystem type inside the upper (e.g. `"ext4"`).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#parent)  parent

```
readonly parent: string | null
```

Manifest digest of the parent snapshot, or `null` for a root.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#createdat)  createdAt

```
readonly createdAt: string
```

RFC 3339 timestamp when the snapshot was created.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#labels)  labels

```
readonly labels: ReadonlyArray<readonly [string, string]>
```

User-supplied labels (sorted by key in canonical form).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#verify)  verify()

```
verify(): Promise<SnapshotVerifyReport>
```

Recompute the upper layer’s content hash and compare against the manifest. Walks data extents only, so a 4 GiB sparse file with a few MB of data verifies in milliseconds.

```
const report = await snap.verify();
if (report.upper.kind === "verified") {
  console.log(`hash matches: ${report.upper.digest}`);
} else {
  console.log("no integrity hash recorded");
}
```

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-builder)  Snapshot.builder()

```
static builder(sourceSandbox: string): SnapshotBuilder
```

Start configuring a new snapshot. The fluent builder is what powers the CLI internally.

```
const snap = await Snapshot.builder("baseline")
  .name("after-pip-install")        // bare name in default dir
  .label("stage", "post-deps")
  .force()                           // overwrite if it exists
  .recordIntegrity()                 // hash the upper layer
  .create();
```

**Builder methods**

| Method | Description |
| --- | --- |
| `.name(string)` | Bare name under the default snapshots directory |
| `.path(string)` | Explicit filesystem path |
| `.label(key, value)` | Add a `key=value` label (may be repeated) |
| `.force()` | Overwrite an existing artifact at the destination |
| `.recordIntegrity()` | Compute and record a content-integrity hash at creation |
| `.build()` | Snapshot the accumulated configuration |
| `.create()` | Build and execute |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-static)  Snapshot (static)

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-open)  Snapshot.open()

```
static open(pathOrName: string): Promise<Snapshot>
```

Open an existing artifact by bare name (resolved under the default snapshots directory) or path. Cheap metadata validation only; does **not** read the upper file. Use [`verify()`](https://docs.microsandbox.dev/sdk/typescript/snapshots#verify) for content checks.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-get)  Snapshot.get()

```
static get(nameOrDigest: string): Promise<SnapshotHandle>
```

Look up a handle in the local index by name, digest, or path.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-list)  Snapshot.list()

```
static list(): Promise<SnapshotHandle[]>
```

List indexed snapshots from the local DB cache.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-listdir)  Snapshot.listDir()

```
static listDir(dir: string): Promise<Snapshot[]>
```

Walk a directory and parse each subdirectory’s manifest. Does not touch the index — useful for inspecting external snapshot collections (e.g. a mounted volume of artifacts that were never imported). Skips entries that don’t look like snapshot artifacts.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-remove)  Snapshot.remove()

```
static remove(pathOrName: string, opts?: { force?: boolean }): Promise<void>
```

Remove a snapshot artifact and its index row. Refuses if the snapshot has indexed children unless `force: true`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-reindex)  Snapshot.reindex()

```
static reindex(dir?: string): Promise<number>
```

Walk `dir` (default: configured snapshots dir) and rebuild the local index. Returns the number of artifacts indexed.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-export)  Snapshot.export()

```
static export(nameOrPath: string, out: string, opts?: ExportOpts): Promise<void>
```

Bundle a snapshot into a `.tar.zst` archive. Computes and embeds the integrity hash in the bundled manifest if not already present.**ExportOpts**

| Field | Type | Description |
| --- | --- | --- |
| `withParents` | `boolean` | Walk the parent chain (no-op today) |
| `withImage` | `boolean` | Bundle the OCI image cache for offline transport |
| `plainTar` | `boolean` | Skip zstd compression and write a plain `.tar` |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshot-import)  Snapshot.import()

```
static import(archive: string, dest?: string): Promise<SnapshotHandle>
```

Unpack a snapshot archive (`.tar.zst` or `.tar`) into the snapshots directory, verifying recorded integrity on the way in. Compression is detected from magic bytes.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#snapshothandle)  SnapshotHandle

Lightweight handle backed by an index row. Returned by [`Snapshot.list()`](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshotlist) and [`Snapshot.get()`](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshotget).

```
const h = await Snapshot.get("after-pip-install");

h.digest;          // string ("sha256:...")
h.name;            // string | null
h.parentDigest;    // string | null — null today
h.imageRef;        // string
h.format;          // "raw" | "qcow2"
h.sizeBytes;       // bigint | null
h.createdAt;       // Date
h.path;            // string

const snap = await h.open();              // metadata-validated
await h.remove({ force: false });          // refuse if has children
```

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/snapshots\#types)  Types

```
export interface ExportOpts {
  withParents?: boolean;
  withImage?: boolean;
  plainTar?: boolean;
}

export type SnapshotVerifyReport =
  | { digest: string; path: string; upper: { kind: "notRecorded" } }
  | { digest: string; path: string;
      upper: { kind: "verified"; algorithm: string; digest: string } };
```

Was this page helpful?

YesNo

[Previous](https://docs.microsandbox.dev/sdk/typescript/secrets) [EventsTypeScript SDK - Events API reference\\
\\
Next](https://docs.microsandbox.dev/sdk/typescript/events)

Ctrl+I

On this page

- [SandboxBuilder](https://docs.microsandbox.dev/sdk/typescript/snapshots#sandboxbuilder)
- [fromSnapshot()](https://docs.microsandbox.dev/sdk/typescript/snapshots#fromsnapshot)
- [SandboxHandle methods](https://docs.microsandbox.dev/sdk/typescript/snapshots#sandboxhandle-methods)
- [snapshot()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot)
- [snapshotTo()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshotto)
- [Snapshot (instance)](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-instance)
- [path](https://docs.microsandbox.dev/sdk/typescript/snapshots#path)
- [digest](https://docs.microsandbox.dev/sdk/typescript/snapshots#digest)
- [sizeBytes](https://docs.microsandbox.dev/sdk/typescript/snapshots#sizebytes)
- [imageRef](https://docs.microsandbox.dev/sdk/typescript/snapshots#imageref)
- [imageManifestDigest](https://docs.microsandbox.dev/sdk/typescript/snapshots#imagemanifestdigest)
- [format](https://docs.microsandbox.dev/sdk/typescript/snapshots#format)
- [fstype](https://docs.microsandbox.dev/sdk/typescript/snapshots#fstype)
- [parent](https://docs.microsandbox.dev/sdk/typescript/snapshots#parent)
- [createdAt](https://docs.microsandbox.dev/sdk/typescript/snapshots#createdat)
- [labels](https://docs.microsandbox.dev/sdk/typescript/snapshots#labels)
- [verify()](https://docs.microsandbox.dev/sdk/typescript/snapshots#verify)
- [Snapshot.builder()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-builder)
- [Snapshot (static)](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-static)
- [Snapshot.open()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-open)
- [Snapshot.get()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-get)
- [Snapshot.list()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-list)
- [Snapshot.listDir()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-listdir)
- [Snapshot.remove()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-remove)
- [Snapshot.reindex()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-reindex)
- [Snapshot.export()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-export)
- [Snapshot.import()](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshot-import)
- [SnapshotHandle](https://docs.microsandbox.dev/sdk/typescript/snapshots#snapshothandle)
- [Types](https://docs.microsandbox.dev/sdk/typescript/snapshots#types)

Assistant

Responses are generated using AI and may contain mistakes.