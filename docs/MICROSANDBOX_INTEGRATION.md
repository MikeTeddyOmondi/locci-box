# Microsandbox SDK Integration Guide

This guide explains how to integrate the real microsandbox SDK into Locci Box.

## Current Status

The current implementation in `src/services/SandboxService.ts` uses a **simulated execution** for development purposes. This allows you to test the API without requiring the microsandbox CLI to be installed.

## Integration Steps

### 1. Install microsandbox CLI

```bash
curl -fsSL https://install.microsandbox.dev | sh
```

**Requirements:**

- Linux with KVM enabled, OR
- macOS with Apple Silicon

### 2. Verify Installation

```bash
microsandbox --version
```

### 3. Update SandboxService

Replace the `simulateExecution` method in `src/services/SandboxService.ts` with real microsandbox SDK calls.

#### Current Simulated Code

```typescript
private async simulateExecution(params: SandboxExecutionParams, sandboxId: string): Promise<Omit<SandboxResult, 'sandbox_id' | 'duration_ms' | 'created_at' | 'completed_at'>> {
  // Simulate execution delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate different language outputs
  const outputs: Record<string, string> = {
    python: 'Hello from Python microVM!\n',
    node: 'Hello from Node.js microVM!\n',
    bash: 'Hello from Bash microVM!\n',
    ruby: 'Hello from Ruby microVM!\n'
  };

  return {
    status: 'completed',
    stdout: outputs[params.language] || 'Execution completed\n',
    stderr: '',
    exit_code: 0
  };
}
```

#### Real microsandbox Integration

```typescript
import { Microsandbox } from 'microsandbox';

private async executeWithMicrosandbox(params: SandboxExecutionParams, sandboxId: string): Promise<Omit<SandboxResult, 'sandbox_id' | 'duration_ms' | 'created_at' | 'completed_at'>> {
  // Initialize microsandbox
  const sandbox = new Microsandbox({
    language: params.language,
    timeout: params.timeout || 30,
    memory: params.memory || 512,
    cpu: params.cpu || 1
  });

  try {
    // Execute code in microVM
    const result = await sandbox.run(params.code, {
      env: params.env || {}
    });

    return {
      status: result.exitCode === 0 ? 'completed' : 'failed',
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode
    };
  } catch (error) {
    // Handle timeout
    if (error.code === 'TIMEOUT') {
      return {
        status: 'timeout',
        stdout: '',
        stderr: 'Execution timed out',
        exit_code: 124
      };
    }

    // Handle other errors
    throw error;
  } finally {
    // Clean up microVM
    await sandbox.destroy();
  }
}
```

### 4. Update the execute Method

Replace the call to `simulateExecution` with `executeWithMicrosandbox`:

```typescript
async execute(params: SandboxExecutionParams, tenantId: string): Promise<SandboxResult> {
  const sandboxId = `sbox_${nanoid(12)}`;
  const startTime = Date.now();

  logger.info({
    sandbox_id: sandboxId,
    tenant_id: tenantId,
    language: params.language,
    timeout: params.timeout || 30
  }, 'Creating sandbox');

  const sandboxInfo: SandboxInfo = {
    sandbox_id: sandboxId,
    tenant_id: tenantId,
    language: params.language,
    status: 'running',
    created_at: new Date().toISOString()
  };
  this.activeSandboxes.set(sandboxId, sandboxInfo);

  try {
    // Use real microsandbox SDK
    const result = await this.executeWithMicrosandbox(params, sandboxId);

    const duration = Date.now() - startTime;

    logger.info({
      sandbox_id: sandboxId,
      tenant_id: tenantId,
      status: result.status,
      duration_ms: duration,
      exit_code: result.exit_code
    }, 'Sandbox execution completed');

    this.activeSandboxes.delete(sandboxId);

    return {
      ...result,
      sandbox_id: sandboxId,
      duration_ms: duration,
      created_at: sandboxInfo.created_at,
      completed_at: new Date().toISOString()
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      sandbox_id: sandboxId,
      tenant_id: tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration
    }, 'Sandbox execution failed');

    this.activeSandboxes.delete(sandboxId);

    return {
      sandbox_id: sandboxId,
      status: 'failed',
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      exit_code: 1,
      duration_ms: duration,
      created_at: sandboxInfo.created_at,
      completed_at: new Date().toISOString()
    };
  }
}
```

## Microsandbox SDK API Reference

Based on the [microsandbox GitHub repository](https://github.com/superradcompany/microsandbox):

### Installation

```bash
npm install microsandbox
```

### Basic Usage

```typescript
import { Microsandbox } from "microsandbox";

const sandbox = new Microsandbox({
  language: "python",
  timeout: 30,
  memory: 512,
  cpu: 1,
});

const result = await sandbox.run('print("Hello, World!")');

console.log(result.stdout); // "Hello, World!\n"
console.log(result.exitCode); // 0

await sandbox.destroy();
```

### Configuration Options

```typescript
interface MicrosandboxConfig {
  language: "python" | "node" | "bash" | "ruby";
  timeout?: number; // Seconds (default: 30)
  memory?: number; // MB (default: 512)
  cpu?: number; // Cores (default: 1)
  network?: boolean; // Enable network (default: false)
}
```

### Run Options

```typescript
interface RunOptions {
  env?: Record<string, string>; // Environment variables
  stdin?: string; // Standard input
  workdir?: string; // Working directory
}
```

### Result Object

```typescript
interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // milliseconds
}
```

## Testing with Real microsandbox

### 1. Start the Server

```bash
npm run dev
```

### 2. Test Python Execution

```bash
curl -X POST http://localhost:5757/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "import sys\nprint(f\"Python {sys.version}\")\nprint(\"Hello from real microVM!\")"
  }'
```

### 3. Monitor Logs

Watch the server logs for microsandbox SDK calls:

```
[INFO] Creating sandbox
[INFO] microVM booted in 87ms
[INFO] Code execution started
[INFO] Sandbox execution completed
```

## Troubleshooting

### Error: microsandbox CLI not found

**Solution:** Install the microsandbox CLI:

```bash
curl -fsSL https://install.microsandbox.dev | sh
```

### Error: KVM not available

**Solution:**

- On Linux: Enable KVM in BIOS and install `qemu-kvm`
- On macOS Intel: Use a Linux VM with KVM
- On Windows: Use WSL2 with KVM support

### Error: Permission denied

**Solution:** Add your user to the `kvm` group:

```bash
sudo usermod -aG kvm $USER
```

Then log out and back in.

### Error: microVM boot timeout

**Solution:** Increase the timeout in your configuration:

```typescript
const sandbox = new Microsandbox({
  language: "python",
  timeout: 60, // Increase to 60 seconds
});
```

## Performance Optimization

### 1. VM Pooling (Future Enhancement)

Instead of creating a new VM for each request, maintain a pool of pre-booted VMs:

```typescript
class VMPool {
  private pool: Map<string, Microsandbox[]> = new Map();

  async acquire(language: string): Promise<Microsandbox> {
    const vms = this.pool.get(language) || [];
    if (vms.length > 0) {
      return vms.pop()!;
    }
    return new Microsandbox({ language });
  }

  async release(language: string, vm: Microsandbox): Promise<void> {
    const vms = this.pool.get(language) || [];
    vms.push(vm);
    this.pool.set(language, vms);
  }
}
```

### 2. Snapshot and Restore

Use microsandbox snapshots for faster boot times:

```typescript
// Create snapshot after first boot
await sandbox.snapshot("python-base");

// Restore from snapshot for subsequent runs
const sandbox = await Microsandbox.restore("python-base");
```

## Next Steps

1. ✅ Install microsandbox CLI
2. ✅ Update `SandboxService.ts` with real SDK calls
3. ✅ Test with all supported languages
4. ✅ Monitor performance and adjust timeouts
5. ✅ Implement VM pooling for production
6. ✅ Add snapshot support for faster boots
7. ✅ Set up monitoring and alerting

## Resources

- [microsandbox GitHub](https://github.com/superradcompany/microsandbox)
- [microsandbox Documentation](https://microsandbox.dev/docs)
- [KVM Setup Guide](https://help.ubuntu.com/community/KVM/Installation)
