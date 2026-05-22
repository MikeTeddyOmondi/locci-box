# Security

## Isolation Model

Locci Box executes user code inside KVM-backed microVMs (microsandbox). Each execution gets a fresh VM; hardware virtualization is the primary isolation boundary. Breaking out requires a hypervisor-level CVE.

**Active network policy: domain allowlist (`NetworkPolicy.builder().defaultDeny()`)**
Set explicitly in `SandboxService.ts`. It:
- Blocks all egress by default
- Allows DNS (UDP/TCP port 53) for hostname resolution
- Allows HTTPS (port 443) egress only to known package registries: `pypi.org`, `*.pypi.org`, `files.pythonhosted.org`, `registry.npmjs.org`, `*.npmjs.org`, `*.alpinelinux.org`
- Blocks all RFC1918 private address ranges
- Blocks cloud metadata endpoints (`169.254.169.254`, `fd00:ec2::254`)
- Blocks arbitrary public internet (no VPS origin IP exposure)

This means sandbox code **cannot** reach the host, other Docker containers, cloud credentials, or arbitrary internet endpoints. Only allowlisted package registries are reachable via TLS.

## Risk Areas

| Risk | Severity | Status |
|---|---|---|
| Direct host/container access via network | ~~High~~ | **Mitigated** — `defaultDeny` blocks all private ranges |
| Cloud metadata SSRF (`169.254.169.254`) | ~~High~~ | **Mitigated** — `defaultDeny` blocks metadata group |
| Public internet egress (abuse, exfil, VPS IP exposure) | ~~Medium~~ | **Mitigated** — `defaultDeny` + domain allowlist blocks arbitrary egress |
| Resource exhaustion (CPU, disk, bandwidth) | Medium | Partial — timeout + CPU/memory limits apply; disk unbounded |
| `privileged: true` blast radius if microVM escape | Critical | By design (KVM requirement) — escape requires hypervisor CVE |
| In-process rate limiter resets on restart | Medium | Backlog — needs Redis |

## Confirmed Test Results

Tested locally against `refactors` branch with `NetworkPolicy.builder().defaultDeny()` + domain allowlist.

| Test | Target | Result | Notes |
|------|--------|--------|-------|
| 1 — Public egress | `ipinfo.io` | ✓ **BLOCKED** | `NO OUTBOUND` — VPS IP no longer discoverable |
| 2 — Cloud metadata SSRF | `169.254.169.254:80` | ✓ **BLOCKED** | Connection refused |
| 3 — Network topology | `ip route` | Informational | Gateway: `100.96.x.x` (microVM internal, host not visible) |
| 4 — Docker bridge | `172.17/18/19.0.1`, `10.0.0.1` | ✓ **BLOCKED** | All gateways unreachable |
| 5 — Host port scan | Ports 22,80,443,5757,5432,6379,27017 | ✓ **BLOCKED** | All `closed` |
| 6 — External IP loopback | `41.220.3.42:5757` | ✓ **BLOCKED** | Port unreachable |
| Allowlist — PyPI | `pip install requests` | ✓ **REACHABLE** | Downloads from `pypi.org` / `files.pythonhosted.org` |
| Allowlist — npm | `npm pack express --dry-run` | ✓ **REACHABLE** | Resolves from `registry.npmjs.org` |
| Allowlist — blocked non-listed | `google.com:443` | ✓ **BLOCKED** | TLS disconnected before handshake |

Previously with `publicOnly` (prod before v1.3.0): Test 1 was open — sandboxes could reach arbitrary internet and expose the VPS origin IP `41.220.3.42`.

## Sandbox Security Tests

All tests install curl first so they work across Alpine and Debian-slim base images.

### Test 1 — Outbound internet + package manager

```bash
loccibox run --profile prod --lang bash --code '
# Install curl if missing (works on Alpine and Debian/Ubuntu)
if ! command -v curl >/dev/null 2>&1; then
  echo "Installing curl..."
  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache curl -q 2>&1
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq curl 2>&1
  else
    echo "NO PACKAGE MANAGER"; exit 1
  fi
fi
curl -s --max-time 5 https://ipinfo.io/ip 2>&1 && echo "" || echo "NO OUTBOUND"'
```

**Pass:** `NO OUTBOUND`
**Fail (expected on this setup):** Returns an IP — public egress is open (`publicOnly` allows this)

---

### Test 2 — Cloud metadata endpoint

```bash
loccibox run --profile prod --lang bash --code '
if ! command -v curl >/dev/null 2>&1; then
  command -v apk >/dev/null 2>&1 && apk add --no-cache curl -q || apt-get install -y -qq curl
fi
curl -sv --max-time 3 http://169.254.169.254/ 2>&1 | head -20 || echo "METADATA UNREACHABLE"'
```

**Pass:** `METADATA UNREACHABLE` — `publicOnly` blocks the metadata group
**Fail:** Any HTTP response — metadata is reachable; critical finding

---

### Test 3 — Discover network topology

```bash
loccibox run --profile prod --lang bash --code \
  'ip route 2>/dev/null; echo "---"; ip addr 2>/dev/null | grep "inet "'
```

Note the default gateway IP for use in Tests 4 and 5.

---

### Test 4 — Internal Docker bridge reachability

```bash
loccibox run --profile prod --lang bash --code '
if ! command -v curl >/dev/null 2>&1; then
  command -v apk >/dev/null 2>&1 && apk add --no-cache curl -q || apt-get install -y -qq curl
fi
for gw in 172.17.0.1 172.18.0.1 172.19.0.1 10.0.0.1; do
  r=$(curl -s --max-time 2 http://$gw:5757/health 2>&1)
  echo "$gw:5757 -> $r"
done'
```

**Pass:** All timeout — `publicOnly` blocks private ranges
**Fail:** Any gateway returns the `/health` JSON — internal network reachable

---

### Test 5 — Host port scan

```bash
loccibox run --profile prod --lang bash --code '
GW=$(ip route | awk "/default/{print \$3}")
echo "Gateway: $GW"
for port in 22 80 443 5757 5432 6379 27017; do
  (echo >/dev/tcp/$GW/$port) 2>/dev/null && echo "OPEN $port" || echo "closed $port"
done'
```

**Pass:** All closed/timed out
**Fail:** Any port responds — host services reachable

---

### Test 6 — External IP loopback

```bash
loccibox run --profile prod --lang bash --code '
if ! command -v curl >/dev/null 2>&1; then
  command -v apk >/dev/null 2>&1 && apk add --no-cache curl -q || apt-get install -y -qq curl
fi
curl -s --max-time 3 http://41.220.3.42:5757/health 2>&1'
```

**Pass:** Timeout
**Fail:** Returns health JSON — external IP routing confirmed

---

## Mitigations

### Public egress abuse (immediate)

Since public internet access is open by design, protect against abuse at the API level. Add a code payload size limit in `src/routes/sandbox.ts`:

```ts
if (typeof code === 'string' && code.length > 65_536) {
  res.status(400).json({ success: false, error: 'Code exceeds 64 KB limit' });
  return;
}
```

### Restrict egress to specific domains (optional hardening)

The microsandbox SDK's `NetworkPolicy.builder()` supports domain-level allowlisting natively via `RuleBuilder`. Rules are evaluated first-match-wins.

```ts
import { Sandbox, NetworkPolicy, Rule, Destination } from "microsandbox";

// Option A — fully offline (no egress at all)
.network((n) => n.policy(NetworkPolicy.none()))

// Option B — allowlist specific domains only (HTTPS port 443)
.network((n) => n.policy(
  NetworkPolicy.builder()
    .defaultDeny()
    .egress((e) =>
      e.tcp().port(443)
        .allow((d) => d.domain("pypi.org"))
        .allow((d) => d.domainSuffix("pypi.org"))        // *.pypi.org
        .allow((d) => d.domain("registry.npmjs.org"))
        .allow((d) => d.domainSuffix("alpinelinux.org")) // apk mirrors
    )
    .build()
))

// Option C — allowlist using Rule/Destination literals (no builder needed)
// Rules are applied first-match-wins.
.network((n) => n.policy({
  defaultEgress: "deny",
  defaultIngress: "allow",
  rules: [
    Rule.allowEgress(Destination.domain("api.openai.com")),
    Rule.allowEgress(Destination.domainSuffix("githubusercontent.com")),
    Rule.denyEgress(Destination.group("metadata")),
  ],
}))
```

**Domain rule-adder methods available on `RuleBuilder`:**
- `.allowDomain(d)` / `.denyDomain(d)` — exact hostname match
- `.allowDomainSuffix(s)` / `.denyDomainSuffix(s)` — matches `s` and `*.s`
- `.allowDomains([...])` / `.denyDomains([...])` — batch exact match
- `.allowDomainSuffixes([...])` / `.denyDomainSuffixes([...])` — batch suffix match

**`Destination` factory methods:**
- `Destination.domain("hostname")` — exact hostname
- `Destination.domainSuffix("example.com")` — matches `example.com` and `*.example.com`
- `Destination.cidr("10.0.0.0/8")` — IP range
- `Destination.group("metadata")` / `"private"` / `"public"` — named groups

### Redis-backed rate limiting (backlog)

The in-process rate limiter resets on API restart. Move to Redis so limits survive restarts and apply across replicas.
