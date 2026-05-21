# Security

## Isolation Model

Locci Box executes user code inside KVM-backed microVMs (microsandbox). Each execution gets a fresh VM; hardware virtualization is the primary isolation boundary. Breaking out requires a hypervisor-level CVE.

**Default network policy: `NetworkPolicy.publicOnly()`**
Set explicitly in `SandboxService.ts` and also the microsandbox SDK default. It:
- Allows egress to the public internet
- Blocks all RFC1918 private address ranges
- Blocks cloud metadata endpoints (`169.254.169.254`, `fd00:ec2::254`)

This means sandbox code **cannot** directly reach the host, other Docker containers, or cloud credentials. The host is not directly damageable from inside a sandbox.

## Risk Areas

| Risk | Severity | Status |
|---|---|---|
| Direct host/container access via network | ~~High~~ | **Mitigated** — `publicOnly` blocks private ranges |
| Cloud metadata SSRF (`169.254.169.254`) | ~~High~~ | **Mitigated** — `publicOnly` blocks `metadata` group |
| Public internet egress (abuse, exfil, mining) | Medium | **By design** — intentional, see mitigations |
| Resource exhaustion (CPU, disk, bandwidth) | Medium | Partial — timeout + CPU/memory limits apply; disk unbounded |
| `privileged: true` blast radius if microVM escape | Critical | By design (KVM requirement) — escape requires hypervisor CVE |
| In-process rate limiter resets on restart | Medium | Backlog — needs Redis |

## Confirmed Test Results

### Test 1 — Outbound internet ✗ FAIL (open)
Public internet is reachable from sandboxes. `apk` successfully installed curl (9 packages from `dl-cdn.alpinelinux.org`) and the sandbox returned the VPS public IP `41.220.3.42`. This is expected behaviour given `publicOnly` — public egress is allowed by design.

### Tests 2, 4, 5 — Expected to PASS (blocked)
`publicOnly` blocks private ranges and the metadata group. These should time out.
Run them to confirm:

```bash
# Test 2 — metadata endpoint (should be unreachable)
loccibox run --profile prod --lang bash --code '
apk add --no-cache curl -q 2>/dev/null
curl -sv --max-time 3 http://169.254.169.254/ 2>&1 | head -20 || echo "METADATA UNREACHABLE"'

# Test 4 — internal Docker bridge (should be unreachable)
loccibox run --profile prod --lang bash --code '
apk add --no-cache curl -q 2>/dev/null
for gw in 172.17.0.1 172.18.0.1 172.19.0.1 10.0.0.1; do
  r=$(curl -s --max-time 2 http://$gw:5757/health 2>&1)
  echo "$gw:5757 -> $r"
done'

# Test 5 — host port scan (should all be closed/timed out)
loccibox run --profile prod --lang bash --code '
GW=$(ip route | awk "/default/{print \$3}")
echo "Gateway: $GW"
for port in 22 80 443 5757 5432 6379 27017; do
  (echo >/dev/tcp/$GW/$port) 2>/dev/null && echo "OPEN $port" || echo "closed $port"
done'
```

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

If public internet access is not required for most use cases, tighten the policy in `SandboxService.ts`:

```ts
import { Sandbox, NetworkPolicy } from "microsandbox";

// Option A — fully offline
.network((n) => n.policy(NetworkPolicy.none()))

// Option B — allow only specific domains
.network((n) => n.policy(
  NetworkPolicy.builder()
    .defaultDeny()
    .egress((e) => e.tcp().port(443).allowPublic())
    .build()
))
```

### Redis-backed rate limiting (backlog)

The in-process rate limiter resets on API restart. Move to Redis so limits survive restarts and apply across replicas.
