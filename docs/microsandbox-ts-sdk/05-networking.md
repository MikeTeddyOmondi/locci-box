---
url: "https://docs.microsandbox.dev/sdk/typescript/networking"
title: "Networking - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/networking#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

Search...

Ctrl KAsk AI

Search...

Navigation

TypeScript SDK

Networking

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

See [Networking](https://docs.microsandbox.dev/networking/overview) for conceptual overview and [TLS Interception](https://docs.microsandbox.dev/networking/tls) for TLS proxy details.

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicy)  NetworkPolicy

A list of rules plus two per-direction defaults, evaluated first-match-wins. Use a static factory for a preset, build a literal, or chain through [`NetworkPolicy.builder()`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicybuilder) for the fluent builder:

```
import { NetworkPolicy, Rule, Destination } from "microsandbox";

// Custom policy literal
const custom = {
  defaultEgress: "deny",
  defaultIngress: "allow",
  rules: [\
    Rule.allowEgress(Destination.domain("api.openai.com")),\
    Rule.denyEgress(Destination.group("metadata")),\
  ],
};

// Or via the builder
const built = NetworkPolicy.builder()
  .defaultDeny()
  .egress((e) => e.tcp().port(443).allowPublic())
  .build();
```

Pass any of these to `NetworkBuilder.policy(...)`.

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-order-matters)  Rule order matters

The first matching rule wins, so a broad rule placed before a narrow one swallows it:

```
const policy = {
  defaultEgress: "deny",
  defaultIngress: "allow",
  rules: [\
    Rule.allowEgress(Destination.cidr("10.0.0.0/8")),  // matches everything in 10.x\
    Rule.denyEgress(Destination.cidr("10.0.0.5/32")),  // never reached\
  ],
};
```

Put specific rules before general ones.

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#shadow-detection)  Shadow detection

[`NetworkPolicyBuilder.build()`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicybuilder) walks the rules and warns when a rule is fully covered by an earlier one in the same direction. Only `ip`, `cidr`, and `group` destinations are checked; domain coverage depends on runtime DNS and is skipped. Builds still succeed; the warning surfaces as a host-side `tracing::warn!` from the rust core:

```
WARN rule #1 (Egress Cidr(10.0.0.5/32) Deny) is shadowed by rule #0 (Egress Cidr(10.0.0.0/8) Allow); to narrow, place the more specific rule first
```

Policy literals constructed via `Rule.allowEgress(...)` etc. do not run through the builder and skip this check.

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#state-accumulation)  State accumulation

State setters (`.tcp()`, `.port()`, etc.) inside a [`RuleBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#rulebuilder) callback carry into every rule-adder that follows. State is **not reset** between adders:

```
NetworkPolicy.builder()
  .egress((r) => r
    .tcp().port(443).allowPublic()    // rule 1: egress, TCP, 443, allow Public
    .udp().allowPrivate()             // rule 2: egress, [TCP, UDP], 443, allow Private
  )
  .build();
```

Use separate `.rule()` / `.egress()` callbacks for rules that need different state.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicy-allowall)  NetworkPolicy.allowAll()

```
static allowAll(): NetworkPolicy
```

Unrestricted network access, including to private addresses and the host machine.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicy-builder)  NetworkPolicy.builder()

```
static builder(): NetworkPolicyBuilder
```

Start a fluent [`NetworkPolicyBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicybuilder). Equivalent to `new NetworkPolicyBuilder()`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicy-none)  NetworkPolicy.none()

```
static none(): NetworkPolicy
```

Deny all traffic. The guest is fully offline. `exec` and `fs` still work since they use the host-guest channel, not the network.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicy-nonlocal)  NetworkPolicy.nonLocal()

```
static nonLocal(): NetworkPolicy
```

Allow egress to public + private (LAN) destinations; ingress allowed by default.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicy-publiconly)  NetworkPolicy.publicOnly()

```
static publicOnly(): NetworkPolicy
```

Block private address ranges and cloud metadata endpoints. Allow everything else. This is the **default** policy.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicybuilder)  NetworkPolicyBuilder

Fluent builder for [`NetworkPolicy`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy). The closure passed to `.rule()` / `.egress()` / `.ingress()` / `.any()` receives a [`RuleBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#rulebuilder); state setters and rule-adders chain freely. The first parse / validation failure surfaces from `.build()`.

```
import { NetworkPolicy } from "microsandbox";

const policy = NetworkPolicy.builder()
  .defaultDeny()
  .egress((e) => e.tcp().port(443).allowPublic().allowPrivate())
  .rule((r) => r.any().deny((d) => d.ip("198.51.100.5")))
  .build();
```

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#any)  any()

```
any(configure: (r: RuleBuilder) => RuleBuilder): this
```

Sugar for [`rule()`](https://docs.microsandbox.dev/sdk/typescript/networking#rule-2) with direction pre-set to `Any`. Rules committed inside apply in both directions.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#build)  build()

```
build(): NetworkPolicy
```

Materialize the accumulated state into a [`NetworkPolicy`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-1). Lazily parses every recorded `.ip()` / `.cidr()` / `.domain()` / `.domainSuffix()` input, validates direction-set and ICMP-egress-only invariants, and emits a host-side warning for each shadowed rule pair.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#defaultallow)  defaultAllow()

```
defaultAllow(): this
```

Set both `defaultEgress` and `defaultIngress` to `"allow"`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#defaultdeny)  defaultDeny()

```
defaultDeny(): this
```

Set both `defaultEgress` and `defaultIngress` to `"deny"`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#defaultegress)  defaultEgress()

```
defaultEgress(action: "allow" | "deny"): this
```

Per-direction override for the egress default action.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| action | `"allow" | "deny"` | Default action for egress |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#defaultingress)  defaultIngress()

```
defaultIngress(action: "allow" | "deny"): this
```

Per-direction override for the ingress default action.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| action | `"allow" | "deny"` | Default action for ingress |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#egress)  egress()

```
egress(configure: (r: RuleBuilder) => RuleBuilder): this
```

Sugar for [`rule()`](https://docs.microsandbox.dev/sdk/typescript/networking#rule-2) with direction pre-set to `Egress`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#ingress)  ingress()

```
ingress(configure: (r: RuleBuilder) => RuleBuilder): this
```

Sugar for [`rule()`](https://docs.microsandbox.dev/sdk/typescript/networking#rule-2) with direction pre-set to `Ingress`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule)  rule()

```
rule(configure: (r: RuleBuilder) => RuleBuilder): this
```

Open a multi-rule batch closure. Direction must be set inside via `.egress()`, `.ingress()`, or `.any()` before any rule-adder.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rulebuilder)  RuleBuilder

Per-rule-batch builder. Lives only inside the callback passed to `.rule()` / `.egress()` / `.ingress()` / `.any()` on a [`NetworkPolicyBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicybuilder). State setters and rule-adders interleave freely; state accumulates eagerly across the callback (see [State accumulation](https://docs.microsandbox.dev/sdk/typescript/networking#state-accumulation)).

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#direction-setters)  Direction setters

Last-write-wins. ICMP rule-adders are egress-only at build time.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#any-2)  any()

```
any(): this
```

Set direction to `Any` for subsequent rule-adders. Rules committed after this apply in both directions.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#egress-2)  egress()

```
egress(): this
```

Set direction to `Egress` for subsequent rule-adders.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#ingress-2)  ingress()

```
ingress(): this
```

Set direction to `Ingress` for subsequent rule-adders.

* * *

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#protocol-setters)  Protocol setters

Protocols accumulate as a set; duplicates dedupe.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#icmpv4)  icmpv4()

```
icmpv4(): this
```

Add `Icmpv4` to the protocols set. Egress-only; an ICMP rule on an `Ingress` or `Any` direction fails build.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#icmpv6)  icmpv6()

```
icmpv6(): this
```

Add `Icmpv6` to the protocols set. Egress-only; same rules as [`icmpv4()`](https://docs.microsandbox.dev/sdk/typescript/networking#icmpv4).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#tcp)  tcp()

```
tcp(): this
```

Add `Tcp` to the protocols set.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#udp)  udp()

```
udp(): this
```

Add `Udp` to the protocols set.

* * *

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#port-setters)  Port setters

Ports accumulate as a set; duplicates dedupe. Always guest-side (egress destination port / ingress listening port).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#port)  port()

```
port(port: number): this
```

Add a single port to the ports set.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| port | `number` | Port number `0..=65535` |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#portrange)  portRange()

```
portRange(lo: number, hi: number): this
```

Add an inclusive port range. `lo > hi` records an error surfaced at `.build()` time.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| lo | `number` | Lower bound (inclusive) |
| hi | `number` | Upper bound (inclusive) |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#ports)  ports()

```
ports(ports: number[]): this
```

Add multiple single ports. Equivalent to calling [`port()`](https://docs.microsandbox.dev/sdk/typescript/networking#port-1) once per element.

* * *

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#group-rule-adders)  Group rule-adders

Each adder commits one rule using the current state and the named destination group.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowhost)  allowHost()

```
allowHost(): this
```

Allow the `Host` group: per-sandbox gateway IPs that back `host.microsandbox.internal`. This is the right shortcut for “let the sandbox reach my host’s localhost”, not [`allowLoopback()`](https://docs.microsandbox.dev/sdk/typescript/networking#allowloopback).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowlinklocal)  allowLinkLocal()

```
allowLinkLocal(): this
```

Allow the `LinkLocal` group (`169.254.0.0/16`, `fe80::/10`). Excludes the metadata IP `169.254.169.254`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowloopback)  allowLoopback()

```
allowLoopback(): this
```

Allow the `Loopback` group (`127.0.0.0/8`, `::1`). The **guest’s own** loopback, not the host. To reach a service on the host’s localhost, use [`allowHost()`](https://docs.microsandbox.dev/sdk/typescript/networking#allowhost) instead. See the [loopback-vs-host watch-out](https://docs.microsandbox.dev/networking/overview#loopback-vs-host-a-common-trap).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowmeta)  allowMeta()

```
allowMeta(): this
```

Allow the `Metadata` group (`169.254.169.254`). **Dangerous on cloud hosts** (exposes IAM credentials).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowmulticast)  allowMulticast()

```
allowMulticast(): this
```

Allow the `Multicast` group (`224.0.0.0/4`, `ff00::/8`).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowprivate)  allowPrivate()

```
allowPrivate(): this
```

Allow the `Private` group (RFC1918 + ULA + CGN).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowpublic)  allowPublic()

```
allowPublic(): this
```

Allow the `Public` group (complement of named categories: every IP not in any other group).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denyhost)  denyHost()

```
denyHost(): this
```

Deny the `Host` group.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denylinklocal)  denyLinkLocal()

```
denyLinkLocal(): this
```

Deny the `LinkLocal` group.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denyloopback)  denyLoopback()

```
denyLoopback(): this
```

Deny the `Loopback` group.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denymeta)  denyMeta()

```
denyMeta(): this
```

Deny the `Metadata` group.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denymulticast)  denyMulticast()

```
denyMulticast(): this
```

Deny the `Multicast` group.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denyprivate)  denyPrivate()

```
denyPrivate(): this
```

Deny the `Private` group.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denypublic)  denyPublic()

```
denyPublic(): this
```

Deny the `Public` group.

* * *

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#domain-rule-adders)  Domain rule-adders

Singular forms add one rule; plural forms add one rule per element.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowdomain)  allowDomain()

```
allowDomain(name: string): this
```

Add one `Destination::Domain` allow rule.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Fully qualified domain name |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowdomainsuffix)  allowDomainSuffix()

```
allowDomainSuffix(suffix: string): this
```

Add one `Destination::DomainSuffix` allow rule. Matches the apex and any subdomain.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| suffix | `string` | Domain suffix |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowdomainsuffixes)  allowDomainSuffixes()

```
allowDomainSuffixes(suffixes: string[]): this
```

Add one `Destination::DomainSuffix` allow rule per suffix.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowdomains)  allowDomains()

```
allowDomains(names: string[]): this
```

Add one `Destination::Domain` allow rule per name.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denydomain)  denyDomain()

```
denyDomain(name: string): this
```

Add one `Destination::Domain` deny rule.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Fully qualified domain name |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denydomainsuffix)  denyDomainSuffix()

```
denyDomainSuffix(suffix: string): this
```

Add one `Destination::DomainSuffix` deny rule. Matches the apex and any subdomain.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| suffix | `string` | Domain suffix |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denydomainsuffixes)  denyDomainSuffixes()

```
denyDomainSuffixes(suffixes: string[]): this
```

Add one `Destination::DomainSuffix` deny rule per suffix.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denydomains)  denyDomains()

```
denyDomains(names: string[]): this
```

Add one `Destination::Domain` deny rule per name.

* * *

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#composite-rule-adders)  Composite rule-adders

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allowlocal)  allowLocal()

```
allowLocal(): this
```

Add three allow rules atomically: `Loopback + LinkLocal + Host`. Each uses the callback’s current state. `Metadata` is intentionally not included; opt in via [`allowMeta()`](https://docs.microsandbox.dev/sdk/typescript/networking#allowmeta) separately.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denylocal)  denyLocal()

```
denyLocal(): this
```

Add three deny rules atomically: `Loopback + LinkLocal + Host`. `Metadata` is intentionally not included.

* * *

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#explicit-destination-rule-adders)  Explicit-destination rule-adders

`.allow()` / `.deny()` open a [`RuleDestinationBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#ruledestinationbuilder) callback. Exactly one destination call commits the rule.

```
NetworkPolicy.builder()
  .egress((r) => r
    .tcp().port(443).allow((d) => d.domain("api.example.com"))
    .deny((d) => d.cidr("198.51.100.0/24"))
  )
  .build();
```

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#allow)  allow()

```
allow(configure: (d: RuleDestinationBuilder) => RuleDestinationBuilder): this
```

Begin an explicit-destination rule with action `Allow`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#deny)  deny()

```
deny(configure: (d: RuleDestinationBuilder) => RuleDestinationBuilder): this
```

Begin an explicit-destination rule with action `Deny`.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-2)  Rule

Factory for individual policy rules. Each method returns a single [`Rule`](https://docs.microsandbox.dev/sdk/typescript/networking#rule-1) value.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-allowany)  Rule.allowAny()

```
static allowAny(destination: Destination): Rule
```

Allow rule with direction `any` (matches in either direction).**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| destination | [`Destination`](https://docs.microsandbox.dev/sdk/typescript/networking#destination-1) | Target filter |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-allowegress)  Rule.allowEgress()

```
static allowEgress(destination: Destination): Rule
```

Allow rule with direction `egress`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| destination | [`Destination`](https://docs.microsandbox.dev/sdk/typescript/networking#destination-1) | Target filter |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-allowingress)  Rule.allowIngress()

```
static allowIngress(destination: Destination): Rule
```

Allow rule with direction `ingress`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| destination | [`Destination`](https://docs.microsandbox.dev/sdk/typescript/networking#destination-1) | Target filter |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-denyany)  Rule.denyAny()

```
static denyAny(destination: Destination): Rule
```

Deny rule with direction `any` (matches in either direction).**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| destination | [`Destination`](https://docs.microsandbox.dev/sdk/typescript/networking#destination-1) | Target filter |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-denyegress)  Rule.denyEgress()

```
static denyEgress(destination: Destination): Rule
```

Deny rule with direction `egress`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| destination | [`Destination`](https://docs.microsandbox.dev/sdk/typescript/networking#destination-1) | Target filter |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-denyingress)  Rule.denyIngress()

```
static denyIngress(destination: Destination): Rule
```

Deny rule with direction `ingress`.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| destination | [`Destination`](https://docs.microsandbox.dev/sdk/typescript/networking#destination-1) | Target filter |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-allowdns)  Rule.allowDns()

```
static allowDns(): Rule
```

Allow plain DNS (UDP/53 and TCP/53) to the sandbox gateway, i.e. the in-process DNS forwarder. The standard one-liner for opening DNS under a deny-by-default policy. See [DNS as egress](https://docs.microsandbox.dev/networking/dns#dns-as-egress) for the underlying semantics.DoT (TCP/853) is intentionally not included; add an explicit `Group::Host tcp/853` allow rule if needed (and pair with TLS interception).

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destination)  Destination

Factory for rule destinations.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destination-any)  Destination.any()

```
static any(): Destination
```

Match any destination.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destination-cidr)  Destination.cidr()

```
static cidr(cidr: string): Destination
```

Match an IP range.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| cidr | `string` | CIDR notation (e.g. `"10.0.0.0/8"`) |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destination-domain)  Destination.domain()

```
static domain(domain: string): Destination
```

Match an exact domain.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| domain | `string` | Fully qualified domain name |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destination-domainsuffix)  Destination.domainSuffix()

```
static domainSuffix(suffix: string): Destination
```

Match the apex domain and every subdomain.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| suffix | `string` | Domain suffix |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destination-group)  Destination.group()

```
static group(group: DestinationGroup): Destination
```

Match a predefined address group.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| group | [`DestinationGroup`](https://docs.microsandbox.dev/sdk/typescript/networking#destinationgroup) | Group keyword |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#portrange-2)  PortRange

Factory for port ranges.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#portrange-range)  PortRange.range()

```
static range(start: number, end: number): PortRange
```

Match an inclusive port range.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| start | `number` | Lower bound (inclusive) |
| end | `number` | Upper bound (inclusive) |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#portrange-single)  PortRange.single()

```
static single(port: number): PortRange
```

Match a single port. `start` and `end` are set to the same value.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| port | `number` | Port number |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkbuilder)  NetworkBuilder

Returned to the callback you pass to `SandboxBuilder.network(...)`. Every setter returns the same builder.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denydomainsuffixes-2)  denyDomainSuffixes()

```
denyDomainSuffixes(...suffixes: string[]): this
```

Deny egress to all subdomains of these suffixes. Same enforcement layers as [`denyDomains()`](https://docs.microsandbox.dev/sdk/typescript/networking#denydomains).**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| suffixes | `string[]` | Domain suffixes |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#denydomains-2)  denyDomains()

```
denyDomains(...names: string[]): this
```

Deny egress to these exact domains. Each entry adds a `deny Domain("...")` policy rule that fires at DNS resolution (REFUSED), TLS first-flight (SNI), and TCP egress (cache fallback). Prepended onto the policy.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| names | `string[]` | Fully qualified domain names |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#dns)  dns()

```
dns(f: (d: DnsBuilder) => DnsBuilder): this
```

Configure DNS interception. See [`DnsBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#dnsbuilder).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#enabled)  enabled()

```
enabled(b: boolean): this
```

Enable or disable networking entirely.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| b | `boolean` | When `false`, no network interface is created |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#maxconnections)  maxConnections()

```
maxConnections(n: number): this
```

Limit the maximum number of concurrent network connections from the sandbox.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#onsecretviolation)  onSecretViolation()

```
onSecretViolation(action: ViolationAction): this
```

Set the action taken when a secret reaches a disallowed host. See [`ViolationAction`](https://docs.microsandbox.dev/sdk/typescript/secrets#violationaction).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#policy)  policy()

```
policy(policy: NetworkPolicy): this
```

Set the policy. Use a [`NetworkPolicy`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy) factory or a literal.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#port-2)  port()

```
port(host: number, guest: number): this
```

Publish a TCP port from the guest to the host.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| host | `number` | Port on the host |
| guest | `number` | Port inside the sandbox |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#portudp)  portUdp()

```
portUdp(host: number, guest: number): this
```

Publish a UDP port from the guest to the host.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| host | `number` | Port on the host |
| guest | `number` | Port inside the sandbox |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#secret)  secret()

```
secret(f: (s: SecretBuilder) => SecretBuilder): this
```

Add a secret. See [`SecretBuilder`](https://docs.microsandbox.dev/sdk/typescript/secrets#secretbuilder).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#secretenv)  secretEnv()

```
secretEnv(envVar: string, value: string, placeholder: string, allowedHost: string): this
```

Four-arg explicit-placeholder shorthand for adding a secret without opening a builder callback.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| envVar | `string` | Environment variable name |
| value | `string` | Real secret value |
| placeholder | `string` | Placeholder string surfaced to the guest |
| allowedHost | `string` | Single hostname allowed to receive the real value |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#tls)  tls()

```
tls(f: (t: TlsBuilder) => TlsBuilder): this
```

Configure TLS interception. See [`TlsBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#tlsbuilder).

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#trusthostcas)  trustHostCAs()

```
trustHostCAs(enabled: boolean): this
```

Whether to ship the host’s trusted root CAs into the guest at boot. Default: `false`. Opt in for corporate MITM proxies (Cloudflare Warp Zero Trust, Zscaler, Netskope, etc.) whose gateway CA is installed on the host but unknown to the guest’s stock Mozilla bundle.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#dnsbuilder)  DnsBuilder

Builder for DNS interception settings. Used in `NetworkBuilder.dns(d => ...)`. Owns rebind protection, nameserver pinning, and the per-query timeout.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#nameservers)  nameservers()

```
nameservers(servers: string[]): this
```

Override upstream nameservers. Replaces any previously-set nameservers.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| servers | `string[]` | Each entry is `IP`, `IP:PORT`, `HOST`, or `HOST:PORT` |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#querytimeoutms)  queryTimeoutMs()

```
queryTimeoutMs(ms: number): this
```

Per-DNS-query timeout in milliseconds.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rebindprotection)  rebindProtection()

```
rebindProtection(enabled: boolean): this
```

Toggle DNS rebinding protection. When enabled, DNS responses resolving to private IPs are blocked.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#tlsbuilder)  TlsBuilder

Builder for TLS interception settings. Used in `NetworkBuilder.tls(t => ...)`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#blockquic)  blockQuic()

```
blockQuic(block: boolean): this
```

Block QUIC on intercepted ports, forcing TCP/TLS fallback.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#bypass)  bypass()

```
bypass(pattern: string): this
```

Skip TLS interception for hosts matching this glob (e.g. `"*.internal.corp"`). Use for domains with certificate pinning.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| pattern | `string` | Glob pattern |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#interceptcacert)  interceptCaCert()

```
interceptCaCert(path: string): this
```

Path to a PEM file used as the intercepting CA’s certificate.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#interceptcakey)  interceptCaKey()

```
interceptCaKey(path: string): this
```

Path to a PEM file used as the intercepting CA’s private key.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#interceptedports)  interceptedPorts()

```
interceptedPorts(ports: number[]): this
```

TCP ports where interception is active. Default: `[443]`.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#upstreamcacert)  upstreamCaCert()

```
upstreamCaCert(path: string): this
```

Path to a PEM file with extra root CAs the proxy should trust.

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#verifyupstream)  verifyUpstream()

```
verifyUpstream(verify: boolean): this
```

Verify upstream server certificates. Default `true`. Set to `false` only for self-signed servers.

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/networking\#types)  Types

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkconfig)  NetworkConfig

Built network configuration produced by `NetworkBuilder.build()`.

| Field | Type | Description |
| --- | --- | --- |
| enabled | `boolean` | Master enable flag |
| ports | `readonly PublishedPort[]` | Port publishings |
| policy | [`NetworkPolicy`](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-1)` | null` | Active policy |
| dns | [`DnsConfig`](https://docs.microsandbox.dev/sdk/typescript/networking#dnsconfig)` | null` | DNS interception |
| tls | [`TlsConfig`](https://docs.microsandbox.dev/sdk/typescript/networking#tlsconfig)` | null` | TLS interception |
| secrets | `readonly SecretEntry[]` | Secret entries |
| secretViolation | [`ViolationAction`](https://docs.microsandbox.dev/sdk/typescript/secrets#violationaction)` | null` | Action on disallowed secret use |
| maxConnections | `number | null` | Maximum concurrent connections |
| trustHostCAs | `boolean` | Ship host CAs into the guest |

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#networkpolicy-2)  NetworkPolicy

```
interface NetworkPolicy {
  readonly defaultEgress: Action;
  readonly defaultIngress: Action;
  readonly rules: readonly Rule[];
}
```

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#rule-3)  Rule

```
interface Rule {
  readonly direction: Direction;
  readonly destination: Destination;
  readonly protocols: readonly Protocol[]; // empty = any
  readonly ports: readonly PortRange[];    // empty = any
  readonly action: Action;
}
```

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destination-2)  Destination

```
type Destination =
  | { kind: "any" }
  | { kind: "cidr"; cidr: string }
  | { kind: "domain"; domain: string }
  | { kind: "domainSuffix"; suffix: string }
  | { kind: "group"; group: DestinationGroup };
```

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#action)  Action

```
type Action = "allow" | "deny";
```

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#direction)  Direction

```
type Direction = "egress" | "ingress" | "any";
```

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#protocol)  Protocol

```
type Protocol = "tcp" | "udp" | "icmpv4" | "icmpv6";
```

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#destinationgroup)  DestinationGroup

```
type DestinationGroup =
  | "public"
  | "loopback"
  | "private"
  | "link-local"
  | "metadata"
  | "multicast"
  | "host";
```

| Value | Description |
| --- | --- |
| `'public'` | Public internet (everything not in another group) |
| `'loopback'` | Guest’s own `127.0.0.0/8` / `::1` |
| `'private'` | RFC1918 LAN ranges |
| `'link-local'` | `169.254.0.0/16` / `fe80::/10` |
| `'metadata'` | Cloud metadata endpoints (`169.254.169.254`, `fd00:ec2::254`) |
| `'multicast'` | Multicast addresses |
| `'host'` | The host machine, reached via `host.microsandbox.internal` |

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#portrange-3)  PortRange

```
interface PortRange {
  readonly start: number;
  readonly end: number;
}
```

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#ruledestinationbuilder)  RuleDestinationBuilder

Returned by [`RuleBuilder`](https://docs.microsandbox.dev/sdk/typescript/networking#rulebuilder)`.allow(d => ...)` / `.deny(d => ...)`. Exactly one destination call commits the rule; dropping without a destination call silently does nothing.

| Method | Description |
| --- | --- |
| `.ip(ip)` | Commit with `Destination::Cidr` of the IP as `/32` or `/128` |
| `.cidr(cidr)` | Commit with `Destination::Cidr` |
| `.domain(domain)` | Commit with `Destination::Domain` |
| `.domainSuffix(suffix)` | Commit with `Destination::DomainSuffix` |
| `.group(group)` | Commit with `Destination::Group`. `group` is a [`DestinationGroup`](https://docs.microsandbox.dev/sdk/typescript/networking#destinationgroup) string |
| `.any()` | Commit with `Destination::Any` |

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#dnsconfig)  DnsConfig

| Field | Type | Description |
| --- | --- | --- |
| nameservers | `readonly string[]` | Upstream nameservers |
| rebindProtection | `boolean | null` | DNS rebinding protection toggle |
| queryTimeoutMs | `number | null` | Per-query timeout |

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#tlsconfig)  TlsConfig

| Field | Type | Description |
| --- | --- | --- |
| bypass | `readonly string[]` | Bypass globs (e.g. `"*.googleapis.com"`) |
| verifyUpstream | `boolean | null` | Verify upstream certs |
| interceptedPorts | `readonly number[]` | Intercepted TCP ports |
| blockQuic | `boolean | null` | Block QUIC on intercepted ports |
| upstreamCaCertPaths | `readonly string[]` | Extra trust roots for upstream verification |
| interceptCaCertPath | `string | null` | Custom intercept CA cert (PEM) |
| interceptCaKeyPath | `string | null` | Custom intercept CA key (PEM) |

### [​](https://docs.microsandbox.dev/sdk/typescript/networking\#publishedport)  PublishedPort

```
interface PublishedPort {
  readonly hostPort: number;
  readonly guestPort: number;
  readonly protocol: "tcp" | "udp";
}
```

Was this page helpful?

YesNo

[Previous](https://docs.microsandbox.dev/sdk/typescript/volumes) [SecretsTypeScript SDK - Secret injection API reference\\
\\
Next](https://docs.microsandbox.dev/sdk/typescript/secrets)

Ctrl+I

On this page

- [NetworkPolicy](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy)
- [Rule order matters](https://docs.microsandbox.dev/sdk/typescript/networking#rule-order-matters)
- [Shadow detection](https://docs.microsandbox.dev/sdk/typescript/networking#shadow-detection)
- [State accumulation](https://docs.microsandbox.dev/sdk/typescript/networking#state-accumulation)
- [NetworkPolicy.allowAll()](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-allowall)
- [NetworkPolicy.builder()](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-builder)
- [NetworkPolicy.none()](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-none)
- [NetworkPolicy.nonLocal()](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-nonlocal)
- [NetworkPolicy.publicOnly()](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-publiconly)
- [NetworkPolicyBuilder](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicybuilder)
- [any()](https://docs.microsandbox.dev/sdk/typescript/networking#any)
- [build()](https://docs.microsandbox.dev/sdk/typescript/networking#build)
- [defaultAllow()](https://docs.microsandbox.dev/sdk/typescript/networking#defaultallow)
- [defaultDeny()](https://docs.microsandbox.dev/sdk/typescript/networking#defaultdeny)
- [defaultEgress()](https://docs.microsandbox.dev/sdk/typescript/networking#defaultegress)
- [defaultIngress()](https://docs.microsandbox.dev/sdk/typescript/networking#defaultingress)
- [egress()](https://docs.microsandbox.dev/sdk/typescript/networking#egress)
- [ingress()](https://docs.microsandbox.dev/sdk/typescript/networking#ingress)
- [rule()](https://docs.microsandbox.dev/sdk/typescript/networking#rule)
- [RuleBuilder](https://docs.microsandbox.dev/sdk/typescript/networking#rulebuilder)
- [Direction setters](https://docs.microsandbox.dev/sdk/typescript/networking#direction-setters)
- [any()](https://docs.microsandbox.dev/sdk/typescript/networking#any-2)
- [egress()](https://docs.microsandbox.dev/sdk/typescript/networking#egress-2)
- [ingress()](https://docs.microsandbox.dev/sdk/typescript/networking#ingress-2)
- [Protocol setters](https://docs.microsandbox.dev/sdk/typescript/networking#protocol-setters)
- [icmpv4()](https://docs.microsandbox.dev/sdk/typescript/networking#icmpv4)
- [icmpv6()](https://docs.microsandbox.dev/sdk/typescript/networking#icmpv6)
- [tcp()](https://docs.microsandbox.dev/sdk/typescript/networking#tcp)
- [udp()](https://docs.microsandbox.dev/sdk/typescript/networking#udp)
- [Port setters](https://docs.microsandbox.dev/sdk/typescript/networking#port-setters)
- [port()](https://docs.microsandbox.dev/sdk/typescript/networking#port)
- [portRange()](https://docs.microsandbox.dev/sdk/typescript/networking#portrange)
- [ports()](https://docs.microsandbox.dev/sdk/typescript/networking#ports)
- [Group rule-adders](https://docs.microsandbox.dev/sdk/typescript/networking#group-rule-adders)
- [allowHost()](https://docs.microsandbox.dev/sdk/typescript/networking#allowhost)
- [allowLinkLocal()](https://docs.microsandbox.dev/sdk/typescript/networking#allowlinklocal)
- [allowLoopback()](https://docs.microsandbox.dev/sdk/typescript/networking#allowloopback)
- [allowMeta()](https://docs.microsandbox.dev/sdk/typescript/networking#allowmeta)
- [allowMulticast()](https://docs.microsandbox.dev/sdk/typescript/networking#allowmulticast)
- [allowPrivate()](https://docs.microsandbox.dev/sdk/typescript/networking#allowprivate)
- [allowPublic()](https://docs.microsandbox.dev/sdk/typescript/networking#allowpublic)
- [denyHost()](https://docs.microsandbox.dev/sdk/typescript/networking#denyhost)
- [denyLinkLocal()](https://docs.microsandbox.dev/sdk/typescript/networking#denylinklocal)
- [denyLoopback()](https://docs.microsandbox.dev/sdk/typescript/networking#denyloopback)
- [denyMeta()](https://docs.microsandbox.dev/sdk/typescript/networking#denymeta)
- [denyMulticast()](https://docs.microsandbox.dev/sdk/typescript/networking#denymulticast)
- [denyPrivate()](https://docs.microsandbox.dev/sdk/typescript/networking#denyprivate)
- [denyPublic()](https://docs.microsandbox.dev/sdk/typescript/networking#denypublic)
- [Domain rule-adders](https://docs.microsandbox.dev/sdk/typescript/networking#domain-rule-adders)
- [allowDomain()](https://docs.microsandbox.dev/sdk/typescript/networking#allowdomain)
- [allowDomainSuffix()](https://docs.microsandbox.dev/sdk/typescript/networking#allowdomainsuffix)
- [allowDomainSuffixes()](https://docs.microsandbox.dev/sdk/typescript/networking#allowdomainsuffixes)
- [allowDomains()](https://docs.microsandbox.dev/sdk/typescript/networking#allowdomains)
- [denyDomain()](https://docs.microsandbox.dev/sdk/typescript/networking#denydomain)
- [denyDomainSuffix()](https://docs.microsandbox.dev/sdk/typescript/networking#denydomainsuffix)
- [denyDomainSuffixes()](https://docs.microsandbox.dev/sdk/typescript/networking#denydomainsuffixes)
- [denyDomains()](https://docs.microsandbox.dev/sdk/typescript/networking#denydomains)
- [Composite rule-adders](https://docs.microsandbox.dev/sdk/typescript/networking#composite-rule-adders)
- [allowLocal()](https://docs.microsandbox.dev/sdk/typescript/networking#allowlocal)
- [denyLocal()](https://docs.microsandbox.dev/sdk/typescript/networking#denylocal)
- [Explicit-destination rule-adders](https://docs.microsandbox.dev/sdk/typescript/networking#explicit-destination-rule-adders)
- [allow()](https://docs.microsandbox.dev/sdk/typescript/networking#allow)
- [deny()](https://docs.microsandbox.dev/sdk/typescript/networking#deny)
- [Rule](https://docs.microsandbox.dev/sdk/typescript/networking#rule-2)
- [Rule.allowAny()](https://docs.microsandbox.dev/sdk/typescript/networking#rule-allowany)
- [Rule.allowEgress()](https://docs.microsandbox.dev/sdk/typescript/networking#rule-allowegress)
- [Rule.allowIngress()](https://docs.microsandbox.dev/sdk/typescript/networking#rule-allowingress)
- [Rule.denyAny()](https://docs.microsandbox.dev/sdk/typescript/networking#rule-denyany)
- [Rule.denyEgress()](https://docs.microsandbox.dev/sdk/typescript/networking#rule-denyegress)
- [Rule.denyIngress()](https://docs.microsandbox.dev/sdk/typescript/networking#rule-denyingress)
- [Rule.allowDns()](https://docs.microsandbox.dev/sdk/typescript/networking#rule-allowdns)
- [Destination](https://docs.microsandbox.dev/sdk/typescript/networking#destination)
- [Destination.any()](https://docs.microsandbox.dev/sdk/typescript/networking#destination-any)
- [Destination.cidr()](https://docs.microsandbox.dev/sdk/typescript/networking#destination-cidr)
- [Destination.domain()](https://docs.microsandbox.dev/sdk/typescript/networking#destination-domain)
- [Destination.domainSuffix()](https://docs.microsandbox.dev/sdk/typescript/networking#destination-domainsuffix)
- [Destination.group()](https://docs.microsandbox.dev/sdk/typescript/networking#destination-group)
- [PortRange](https://docs.microsandbox.dev/sdk/typescript/networking#portrange-2)
- [PortRange.range()](https://docs.microsandbox.dev/sdk/typescript/networking#portrange-range)
- [PortRange.single()](https://docs.microsandbox.dev/sdk/typescript/networking#portrange-single)
- [NetworkBuilder](https://docs.microsandbox.dev/sdk/typescript/networking#networkbuilder)
- [denyDomainSuffixes()](https://docs.microsandbox.dev/sdk/typescript/networking#denydomainsuffixes-2)
- [denyDomains()](https://docs.microsandbox.dev/sdk/typescript/networking#denydomains-2)
- [dns()](https://docs.microsandbox.dev/sdk/typescript/networking#dns)
- [enabled()](https://docs.microsandbox.dev/sdk/typescript/networking#enabled)
- [maxConnections()](https://docs.microsandbox.dev/sdk/typescript/networking#maxconnections)
- [onSecretViolation()](https://docs.microsandbox.dev/sdk/typescript/networking#onsecretviolation)
- [policy()](https://docs.microsandbox.dev/sdk/typescript/networking#policy)
- [port()](https://docs.microsandbox.dev/sdk/typescript/networking#port-2)
- [portUdp()](https://docs.microsandbox.dev/sdk/typescript/networking#portudp)
- [secret()](https://docs.microsandbox.dev/sdk/typescript/networking#secret)
- [secretEnv()](https://docs.microsandbox.dev/sdk/typescript/networking#secretenv)
- [tls()](https://docs.microsandbox.dev/sdk/typescript/networking#tls)
- [trustHostCAs()](https://docs.microsandbox.dev/sdk/typescript/networking#trusthostcas)
- [DnsBuilder](https://docs.microsandbox.dev/sdk/typescript/networking#dnsbuilder)
- [nameservers()](https://docs.microsandbox.dev/sdk/typescript/networking#nameservers)
- [queryTimeoutMs()](https://docs.microsandbox.dev/sdk/typescript/networking#querytimeoutms)
- [rebindProtection()](https://docs.microsandbox.dev/sdk/typescript/networking#rebindprotection)
- [TlsBuilder](https://docs.microsandbox.dev/sdk/typescript/networking#tlsbuilder)
- [blockQuic()](https://docs.microsandbox.dev/sdk/typescript/networking#blockquic)
- [bypass()](https://docs.microsandbox.dev/sdk/typescript/networking#bypass)
- [interceptCaCert()](https://docs.microsandbox.dev/sdk/typescript/networking#interceptcacert)
- [interceptCaKey()](https://docs.microsandbox.dev/sdk/typescript/networking#interceptcakey)
- [interceptedPorts()](https://docs.microsandbox.dev/sdk/typescript/networking#interceptedports)
- [upstreamCaCert()](https://docs.microsandbox.dev/sdk/typescript/networking#upstreamcacert)
- [verifyUpstream()](https://docs.microsandbox.dev/sdk/typescript/networking#verifyupstream)
- [Types](https://docs.microsandbox.dev/sdk/typescript/networking#types)
- [NetworkConfig](https://docs.microsandbox.dev/sdk/typescript/networking#networkconfig)
- [NetworkPolicy](https://docs.microsandbox.dev/sdk/typescript/networking#networkpolicy-2)
- [Rule](https://docs.microsandbox.dev/sdk/typescript/networking#rule-3)
- [Destination](https://docs.microsandbox.dev/sdk/typescript/networking#destination-2)
- [Action](https://docs.microsandbox.dev/sdk/typescript/networking#action)
- [Direction](https://docs.microsandbox.dev/sdk/typescript/networking#direction)
- [Protocol](https://docs.microsandbox.dev/sdk/typescript/networking#protocol)
- [DestinationGroup](https://docs.microsandbox.dev/sdk/typescript/networking#destinationgroup)
- [PortRange](https://docs.microsandbox.dev/sdk/typescript/networking#portrange-3)
- [RuleDestinationBuilder](https://docs.microsandbox.dev/sdk/typescript/networking#ruledestinationbuilder)
- [DnsConfig](https://docs.microsandbox.dev/sdk/typescript/networking#dnsconfig)
- [TlsConfig](https://docs.microsandbox.dev/sdk/typescript/networking#tlsconfig)
- [PublishedPort](https://docs.microsandbox.dev/sdk/typescript/networking#publishedport)

Assistant

Responses are generated using AI and may contain mistakes.