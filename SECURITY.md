# Security

## Threat Model

Locci Box executes arbitrary user code inside KVM-backed microVMs (microsandbox). The primary isolation boundary is hardware virtualization — breaking out requires a hypervisor-level CVE. However, the API container runs with `privileged: true` (required for KVM + `/dev/kvm`), which means any microVM escape would grant full host access.

## Known Risk Areas

| Risk | Severity | Status |
|---|---|---|
| Outbound network from sandboxes | High | Untested — see tests below |
| Cloud/VPS metadata SSRF via `169.254.169.254` | High | Untested |
| Internal Docker network reachability | High | Untested |
| `privileged: true` blast radius on microVM escape | Critical | By design (KVM requirement) |
| In-process rate limiter resets on restart | Medium | Backlog — needs Redis |

## Sandbox Security Tests

Run these against the live API to verify the isolation boundaries. All tests use `loccibox run` with a bash sandbox.

### Test 1 — Outbound internet (baseline)

Confirms whether sandbox code can make outbound network requests at all. Tests both native `curl` availability and the ability to install it if missing (which itself confirms outbound + package manager access).

```bash
loccibox run --profile prod --lang bash --code '
# Try curl directly first
if command -v curl >/dev/null 2>&1; then
  echo "curl already present"
  curl -s --max-time 5 https://ipinfo.io/ip 2>&1 && echo "" || echo "NO OUTBOUND"
else
  echo "curl not found — attempting install"
  # Alpine (node/bash/ruby images)
  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache curl 2>&1 && curl -s --max-time 5 https://ipinfo.io/ip || echo "INSTALL FAILED OR NO OUTBOUND"
  # Debian/Ubuntu (python:slim image)
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq curl 2>&1 && curl -s --max-time 5 https://ipinfo.io/ip || echo "INSTALL FAILED OR NO OUTBOUND"
  else
    echo "NO PACKAGE MANAGER"
  fi
fi'
```

**Pass:** `INSTALL FAILED OR NO OUTBOUND` or `NO PACKAGE MANAGER` on install attempt
**Fail (severe):** Package installs successfully and returns an IP — confirms outbound network AND unrestricted package manager access inside the microVM

---

### Test 2 — Link-local metadata endpoint

Checks whether the VPS metadata service responds from inside the microVM. Relevant on cloud providers (AWS, GCP, DigitalOcean). On a bare VPS this will likely time out, but worth confirming.

```bash
loccibox run --profile prod --lang bash --code \
  'curl -sv --max-time 3 http://169.254.169.254/ 2>&1 | head -30 || echo "METADATA UNREACHABLE"'
```

**Pass:** `METADATA UNREACHABLE` / connection timeout
**Fail:** Any HTTP response — metadata is reachable; block `169.254.169.254` immediately via iptables

---

### Test 3 — Discover Docker gateway / host IP

Reveals the network topology visible from inside the microVM.

```bash
loccibox run --profile prod --lang bash --code \
  'ip route 2>/dev/null; echo "---"; ip addr 2>/dev/null | grep "inet "'
```

Note the default gateway IP — use it in Tests 4 and 5.

---

### Test 4 — Reach the API container on internal Docker bridge

Attempts to hit the Express API from inside the sandbox, bypassing Cloudflare and any external firewall.

```bash
loccibox run --profile prod --lang bash --code '
for gw in 172.17.0.1 172.18.0.1 172.19.0.1 10.0.0.1; do
  r=$(curl -s --max-time 2 http://$gw:5757/health 2>&1)
  echo "$gw:5757 -> $r"
done'
```

**Pass:** All timeouts / connection refused
**Fail:** Any gateway returns the `/health` JSON — internal network is reachable from the sandbox

---

### Test 5 — Port scan host gateway

Scans common services on the Docker bridge gateway (effectively the host).

```bash
loccibox run --profile prod --lang bash --code '
GW=$(ip route | awk "/default/{print \$3}")
echo "Gateway: $GW"
for port in 22 80 443 5757 5432 6379 27017; do
  (echo >/dev/tcp/$GW/$port) 2>/dev/null \
    && echo "OPEN  $port" \
    || echo "closed $port"
done'
```

**Pass:** All ports closed
**Fail:** SSH (22), DB ports (5432, 6379, 27017), or the API port (5757) respond — host services are reachable

---

### Test 6 — External IP loopback

Checks whether sandbox code can reach the VPS's own public IP (useful to confirm egress routing).

```bash
loccibox run --profile prod --lang bash --code \
  'curl -s --max-time 3 http://41.220.3.42:5757/health 2>&1'
```

**Pass:** Timeout / connection refused
**Fail:** Returns the health JSON — outbound + public IP routing confirmed reachable

---

## Recommended Mitigations

### Block metadata endpoint (immediate)

On the VPS host, before starting the containers:

```bash
# Block link-local metadata endpoint from all container traffic
iptables -I DOCKER-USER -d 169.254.169.254 -j DROP
# Persist across reboots (Debian/Ubuntu)
apt install iptables-persistent -y && netfilter-persistent save
```

### Restrict sandbox egress (if outbound is confirmed open)

```bash
# Allow DNS + established connections only from sandbox network
iptables -I DOCKER-USER -s 172.0.0.0/8 -m state --state NEW -j DROP
iptables -I DOCKER-USER -s 172.0.0.0/8 -p udp --dport 53 -j ACCEPT
```

### Enforce code payload size limit

In `src/routes/sandbox.ts`, add a size check before execution:

```ts
if (typeof code === 'string' && code.length > 65_536) {
  res.status(400).json({ success: false, error: 'Code exceeds 64 KB limit' });
  return;
}
```

### Longer term

- Redis-backed rate limiting (in backlog) — current in-process limiter resets on restart
- Evaluate whether microsandbox supports per-VM network namespaces with egress control
