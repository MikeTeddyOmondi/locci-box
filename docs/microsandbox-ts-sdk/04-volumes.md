---
url: "https://docs.microsandbox.dev/sdk/typescript/volumes"
title: "Volumes - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/volumes#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

Search...

Ctrl KAsk AI

Search...

Navigation

TypeScript SDK

Volumes

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

See [Volumes](https://docs.microsandbox.dev/sandboxes/volumes) for usage examples and patterns.

## [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volume)  Volume

Named volumes are managed by microsandbox and stored at `~/.microsandbox/volumes/<name>/`. They persist independently of any sandbox.

```
import { Volume } from "microsandbox";

const data = await Volume.builder("my-data")
  .quota(100)
  .label("env", "prod")
  .create();
```

## [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#static-methods)  Static methods

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volume-builder)  Volume.builder()

```
static builder(name: string): VolumeBuilder
```

Begin building a named volume. Configure with `.quota(...)` and `.label(...)`, then call `.create()`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Volume name |

**Returns**

| Type | Description |
| --- | --- |
| [`VolumeBuilder`](https://docs.microsandbox.dev/sdk/typescript/volumes#volumebuilder) | Fluent builder |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volume-get)  Volume.get()

```
static get(name: string): Promise<VolumeHandle>
```

Get a handle to an existing named volume.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Volume name |

**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`VolumeHandle`](https://docs.microsandbox.dev/sdk/typescript/volumes#volumehandle)`>` | Volume handle |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volume-list)  Volume.list()

```
static list(): Promise<VolumeHandle[]>
```

List all named volumes. Handles returned from `list()` are read-only — call `Volume.get(name)` to get a live handle for `.remove()` / `.fs()`.**Returns**

| Type | Description |
| --- | --- |
| `Promise<` [`VolumeHandle`](https://docs.microsandbox.dev/sdk/typescript/volumes#volumehandle)`[]>` | All volumes |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volume-remove)  Volume.remove()

```
static remove(name: string): Promise<void>
```

Delete a named volume and its contents. Fails if the volume is currently mounted.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Volume name |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#instance-properties)  Instance properties

#### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#name)  name

```
get name(): string
```

The volume’s name.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#path)  path

```
get path(): string
```

Absolute host path to the volume’s directory.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#fs)  fs()

```
fs(): VolumeFs
```

Get a host-side filesystem handle for this volume — no sandbox required.

```
const vfs = data.fs();
await vfs.write("seed.txt", "hello");
console.log(await vfs.list(""));
```

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#mounts)  Mounts

Volume mounts attach a host directory, named volume, tmpfs, or disk image to a guest path. Configure them via `SandboxBuilder.volume(guestPath, m => ...)`:

```
await using sb = await Sandbox.builder("worker")
  .image("alpine")
  .volume("/host",    (m) => m.bind("/var/data"))
  .volume("/data",    (m) => m.named("my-data"))
  .volume("/scratch", (m) => m.tmpfs().size(128))
  .volume("/img",     (m) => m.disk("./data.qcow2").fstype("ext4").readonly())
  .create();
```

### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#mountbuilder)  MountBuilder

Used inside `SandboxBuilder.volume(guestPath, m => ...)`. Pick exactly one mount kind, then chain modifiers.

| Method | Description |
| --- | --- |
| `bind(host)` | Mount a host directory into the guest. |
| `named(name)` | Mount a named volume created via [`Volume.builder`](https://docs.microsandbox.dev/sdk/typescript/volumes#volumebuilder). |
| `tmpfs()` | Mount an in-memory filesystem. |
| `disk(host)` | Mount a host disk image as a virtio-blk device. |
| `format(fmt)` | Disk image format (`'qcow2' | 'raw' | 'vmdk'`). Defaults to the file extension. Disk only. |
| `fstype(fs)` | Inner filesystem type (e.g. `"ext4"`). Disk only; omit to autodetect. |
| `readonly()` | Mount read-only. |
| `size(mib)` | Cap in MiB. Tmpfs only. |
| `build()` | Internal — produce a `VolumeMount`. |

### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volumemount)  VolumeMount

Discriminated union produced by `MountBuilder.build()`.

```
type VolumeMount =
  | { kind: "bind"; host: string; guest: string; readonly: boolean }
  | { kind: "named"; name: string; guest: string; readonly: boolean }
  | { kind: "tmpfs"; guest: string; sizeMib: number | null; readonly: boolean }
  | {
      kind: "disk";
      host: string;
      guest: string;
      format: DiskImageFormat;
      fstype: string | null;
      readonly: boolean;
    };
```

### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#diskimageformat)  DiskImageFormat

```
type DiskImageFormat = "qcow2" | "raw" | "vmdk";
```

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#types)  Types

### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volumebuilder)  VolumeBuilder

| Method | Description |
| --- | --- |
| `quota(mib)` | Maximum storage size in MiB |
| `label(key, value)` | Add a metadata label |
| `build()` | Materialize a [`VolumeConfig`](https://docs.microsandbox.dev/sdk/typescript/volumes#volumeconfig) |
| `create()` | Build and create the volume; returns a [`Volume`](https://docs.microsandbox.dev/sdk/typescript/volumes#volume) |

### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volumeconfig)  VolumeConfig

Frozen configuration produced by `VolumeBuilder.build()`.

| Field | Type | Description |
| --- | --- | --- |
| name | `string` | Volume name |
| quotaMib | `number | null` | Maximum storage size in MiB |
| labels | `ReadonlyArray<readonly [string, string]>` | Metadata labels |

### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volumehandle)  VolumeHandle

| Property / Method | Type | Description |
| --- | --- | --- |
| name | `string` | Volume name |
| quotaMib | `number | null` | Storage quota |
| usedBytes | `number` | Current disk usage in bytes |
| labels | `ReadonlyArray<readonly [string, string]>` | Metadata labels |
| createdAt | `Date | null` | Creation timestamp |
| fs() | [`VolumeFs`](https://docs.microsandbox.dev/sdk/typescript/volumes#volumefs) | Host-side filesystem on this volume (live handles only) |
| remove() | `Promise<void>` | Delete this volume (live handles only) |

Handles in the array returned by `Volume.list()` are read-only: calling `.fs()` or `.remove()` throws. Use `Volume.get(name)` to upgrade.

### [​](https://docs.microsandbox.dev/sdk/typescript/volumes\#volumefs)  VolumeFs

Host-side filesystem operations on a volume’s directory. Same surface area as [`SandboxFs`](https://docs.microsandbox.dev/sdk/typescript/filesystem) (read, readToString, readStream, write, writeStream, list, mkdir, removeDir, remove, copy, rename, stat, exists) — but operates directly on the host without booting a sandbox.

Was this page helpful?

YesNo

[Previous](https://docs.microsandbox.dev/sdk/typescript/filesystem) [NetworkingTypeScript SDK - Network API reference\\
\\
Next](https://docs.microsandbox.dev/sdk/typescript/networking)

Ctrl+I

On this page

- [Volume](https://docs.microsandbox.dev/sdk/typescript/volumes#volume)
- [Static methods](https://docs.microsandbox.dev/sdk/typescript/volumes#static-methods)
- [Volume.builder()](https://docs.microsandbox.dev/sdk/typescript/volumes#volume-builder)
- [Volume.get()](https://docs.microsandbox.dev/sdk/typescript/volumes#volume-get)
- [Volume.list()](https://docs.microsandbox.dev/sdk/typescript/volumes#volume-list)
- [Volume.remove()](https://docs.microsandbox.dev/sdk/typescript/volumes#volume-remove)
- [Instance properties](https://docs.microsandbox.dev/sdk/typescript/volumes#instance-properties)
- [name](https://docs.microsandbox.dev/sdk/typescript/volumes#name)
- [path](https://docs.microsandbox.dev/sdk/typescript/volumes#path)
- [fs()](https://docs.microsandbox.dev/sdk/typescript/volumes#fs)
- [Mounts](https://docs.microsandbox.dev/sdk/typescript/volumes#mounts)
- [MountBuilder](https://docs.microsandbox.dev/sdk/typescript/volumes#mountbuilder)
- [VolumeMount](https://docs.microsandbox.dev/sdk/typescript/volumes#volumemount)
- [DiskImageFormat](https://docs.microsandbox.dev/sdk/typescript/volumes#diskimageformat)
- [Types](https://docs.microsandbox.dev/sdk/typescript/volumes#types)
- [VolumeBuilder](https://docs.microsandbox.dev/sdk/typescript/volumes#volumebuilder)
- [VolumeConfig](https://docs.microsandbox.dev/sdk/typescript/volumes#volumeconfig)
- [VolumeHandle](https://docs.microsandbox.dev/sdk/typescript/volumes#volumehandle)
- [VolumeFs](https://docs.microsandbox.dev/sdk/typescript/volumes#volumefs)

Assistant

Responses are generated using AI and may contain mistakes.