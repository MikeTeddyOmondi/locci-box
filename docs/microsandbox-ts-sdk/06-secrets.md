---
url: "https://docs.microsandbox.dev/sdk/typescript/secrets"
title: "Secrets - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/secrets#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

Search...

Ctrl KAsk AI

Search...

Navigation

TypeScript SDK

Secrets

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

See [Secrets](https://docs.microsandbox.dev/sandboxes/secrets) for how placeholder substitution works and usage examples.

## [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#adding-secrets)  Adding secrets

Secrets are configured on a sandbox via `SandboxBuilder.secret(s => ...)` (or its shorthand `secretEnv`). The guest only ever sees a placeholder — the real value is substituted by the TLS proxy when traffic reaches an allowed host.

```
import { Sandbox } from "microsandbox";

// Auto-placeholder shorthand: generates `$MSB_OPENAI_API_KEY`.
await using sb = await Sandbox.builder("agent")
  .image("python")
  .secretEnv("OPENAI_API_KEY", process.env.OPENAI_API_KEY!, "api.openai.com")
  .create();

// Full control via SecretBuilder.
await using sb2 = await Sandbox.builder("agent2")
  .image("python")
  .secret((s) =>
    s.env("STRIPE_KEY")
      .value(process.env.STRIPE_KEY!)
      .allowHost("api.stripe.com")
      .allowHostPattern("*.stripe.com")
      .injectHeaders(true)
      .injectQuery(false),
  )
  .create();
```

The same `secret(...)` and `secretEnv(...)` methods are also available inside `SandboxBuilder.network(n => n.secret(...))` and on `NetworkBuilder.secretEnv(envVar, value, placeholder, allowedHost)` (4-arg explicit-placeholder shorthand).

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#secretbuilder)  SecretBuilder

Fluent builder used inside `SandboxBuilder.secret(s => ...)` or `NetworkBuilder.secret(s => ...)`. Every setter returns the same builder so calls can be chained.

| Method | Description |
| --- | --- |
| `env(varName)` | Environment variable to expose the placeholder under. **Required.** |
| `value(value)` | The real secret value (stays on the host). **Required.** |
| `placeholder(placeholder)` | Custom placeholder. Auto-generated as `$MSB_<ENV_VAR>` when omitted. |
| `allowHost(host)` | Allow substitution to a specific host (exact match). |
| `allowHostPattern(pattern)` | Allow substitution to any host matching a wildcard. |
| `allowAnyHostDangerous(true)` | Permit substitution to any host. Acknowledge the risk explicitly. |
| `requireTlsIdentity(enabled)` | Require a verified TLS identity before substituting. Default `true`. |
| `injectHeaders(enabled)` | Allow substitution in HTTP headers. Default `true`. |
| `injectBasicAuth(enabled)` | Decode `Authorization: Basic <base64>` credentials, substitute the placeholder in the decoded `user:password`, and re-encode. Default `true`. Other schemes are handled by `injectHeaders`. |
| `injectQuery(enabled)` | Allow substitution in URL query parameters. Default `false`. |
| `injectBody(enabled)` | Allow substitution in the HTTP request body. Default `false`. |
| `build()` | Produce a [`SecretEntry`](https://docs.microsandbox.dev/sdk/typescript/secrets#secretentry). |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#convenience-helpers)  Convenience helpers

#### [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#sandboxbuilder-secretenv)  SandboxBuilder.secretEnv()

```
secretEnv(envVar: string, value: string, allowedHost: string): this
```

Three-argument shorthand. Auto-generates the placeholder as `$MSB_<ENV_VAR>` and allows substitution only on `allowedHost`.

#### [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#networkbuilder-secretenv)  NetworkBuilder.secretEnv()

```
secretEnv(
  envVar: string,
  value: string,
  placeholder: string,
  allowedHost: string,
): this
```

Four-argument shorthand. Same as the `SandboxBuilder` form but lets you provide the placeholder explicitly.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#types)  Types

### [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#secretentry)  SecretEntry

The object produced by `SecretBuilder.build()`. You normally construct one with the builder, but the shape is exposed for advanced cases.

| Field | Type | Description |
| --- | --- | --- |
| envVar | `string` | Environment variable name |
| value | `string` | Real secret value (stays on the host) |
| placeholder | `string | null` | Custom placeholder; defaults to `$MSB_<ENV_VAR>` when `null` |
| allowedHosts | `readonly string[]` | Allowed hosts (exact match) |
| allowedHostPatterns | `readonly string[]` | Wildcard host patterns |
| allowAnyHost | `boolean` | Permit substitution to any host |
| requireTlsIdentity | `boolean` | Require verified TLS identity |
| injection | [`SecretInjection`](https://docs.microsandbox.dev/sdk/typescript/secrets#secretinjection) | Where to substitute |

### [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#secretinjection)  SecretInjection

Controls where the TLS proxy substitutes the placeholder with the real value. Each field is optional; omitted fields use the default.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| headers? | `boolean` | `true` | Replace the placeholder anywhere in HTTP headers. |
| basicAuth? | `boolean` | `true` | Decode `Authorization: Basic <base64>` credentials, substitute the placeholder in the decoded `user:password`, and re-encode. Other schemes (`Bearer`, `Digest`) are handled by `headers`. |
| queryParams? | `boolean` | `false` | Replace the placeholder in URL query parameters. |
| body? | `boolean` | `false` | Replace the placeholder in the HTTP request body. `Content-Length` is rewritten. |

### [​](https://docs.microsandbox.dev/sdk/typescript/secrets\#violationaction)  ViolationAction

Action taken when a secret placeholder is sent to a disallowed host. Set on the network builder via `NetworkBuilder.onSecretViolation(action)`.

```
type ViolationAction = "block" | "block-and-log" | "block-and-terminate";
```

| Value | Description |
| --- | --- |
| `'block'` | Silently drop the request. The guest sees a connection reset. This is the default. |
| `'block-and-log'` | Drop the request and emit a warning log on the host side. |
| `'block-and-terminate'` | Drop the request, log an error, and shut down the entire sandbox. |

Was this page helpful?

YesNo

[Previous](https://docs.microsandbox.dev/sdk/typescript/networking) [SnapshotsTypeScript SDK - Snapshot API reference\\
\\
Next](https://docs.microsandbox.dev/sdk/typescript/snapshots)

Ctrl+I

On this page

- [Adding secrets](https://docs.microsandbox.dev/sdk/typescript/secrets#adding-secrets)
- [SecretBuilder](https://docs.microsandbox.dev/sdk/typescript/secrets#secretbuilder)
- [Convenience helpers](https://docs.microsandbox.dev/sdk/typescript/secrets#convenience-helpers)
- [SandboxBuilder.secretEnv()](https://docs.microsandbox.dev/sdk/typescript/secrets#sandboxbuilder-secretenv)
- [NetworkBuilder.secretEnv()](https://docs.microsandbox.dev/sdk/typescript/secrets#networkbuilder-secretenv)
- [Types](https://docs.microsandbox.dev/sdk/typescript/secrets#types)
- [SecretEntry](https://docs.microsandbox.dev/sdk/typescript/secrets#secretentry)
- [SecretInjection](https://docs.microsandbox.dev/sdk/typescript/secrets#secretinjection)
- [ViolationAction](https://docs.microsandbox.dev/sdk/typescript/secrets#violationaction)

Assistant

Responses are generated using AI and may contain mistakes.