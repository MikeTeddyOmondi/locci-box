---
url: "https://docs.microsandbox.dev/sdk/typescript/events"
title: "Events - microsandbox"
---

[Skip to main content](https://docs.microsandbox.dev/sdk/typescript/events#content-area)

[microsandbox home page![light logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-light.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=b45f81c0c0786037c520040351776f0c)![dark logo](https://mintcdn.com/superradcompanyinc/h2JI9gRxoad-oxxo/images/microsandbox-banner-dark.svg?fit=max&auto=format&n=h2JI9gRxoad-oxxo&q=85&s=a19d15bf347ffed562357e83a8e47e57)](https://microsandbox.dev/)

Search...

Ctrl KAsk AI

Search...

Navigation

TypeScript SDK

Events

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

[Documentation](https://docs.microsandbox.dev/getting-started/introduction) [SDK Reference](https://docs.microsandbox.dev/sdk/overview) [CLI Reference](https://docs.microsandbox.dev/cli/overview) [Recipes](https://docs.microsandbox.dev/recipes/docker) [Changelog](https://docs.microsandbox.dev/changelog/2026-05-15)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.microsandbox.dev/llms.txt](https://docs.microsandbox.dev/llms.txt)
>
> Use this file to discover all available pages before exploring further.

Events are coming soon and not yet available in the current SDK.

See [Events](https://docs.microsandbox.dev/sandboxes/events) for usage examples and guest-side emitting.

## [​](https://docs.microsandbox.dev/sdk/typescript/events\#sandbox-methods)  Sandbox methods

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/events\#emit)  emit()

```
emit(eventName: string, data: any): Promise<void>
```

Send a named event with a JSON-serializable payload into the guest. Any process listening on the agent socket (`/run/agent.sock`) receives it.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| eventName | `string` | Event name (e.g. `"task.start"`) |
| data | `any` | Event payload - must be JSON-serializable |

* * *

#### [​](https://docs.microsandbox.dev/sdk/typescript/events\#onevent)  onEvent()

```
onEvent(eventName: string, callback: (event: EventData) => void): Subscription
```

Subscribe to named events emitted by guest processes. The callback fires each time the guest sends a matching event through `/run/agent.sock`. Multiple subscriptions to the same event name are supported.**Parameters**

| Name | Type | Description |
| --- | --- | --- |
| eventName | `string` | Event name to subscribe to (e.g. `"task.progress"`) |
| callback | `(event: EventData) => void` | Called with the event data each time |

**Returns**

| Type | Description |
| --- | --- |
| `Subscription` | Call `.unsubscribe()` to stop receiving events |

* * *

## [​](https://docs.microsandbox.dev/sdk/typescript/events\#types)  Types

### [​](https://docs.microsandbox.dev/sdk/typescript/events\#eventdata)  EventData

Data received from a guest event.

| Field | Type | Description |
| --- | --- | --- |
| data | `any` | Event payload. `undefined` if the event had no data. |
| event | `string` | Event name |

Was this page helpful?

YesNo

[Previous](https://docs.microsandbox.dev/sdk/typescript/snapshots) [SandboxPython SDK - Sandbox API reference\\
\\
Next](https://docs.microsandbox.dev/sdk/python/sandbox)

Ctrl+I

On this page

- [Sandbox methods](https://docs.microsandbox.dev/sdk/typescript/events#sandbox-methods)
- [emit()](https://docs.microsandbox.dev/sdk/typescript/events#emit)
- [onEvent()](https://docs.microsandbox.dev/sdk/typescript/events#onevent)
- [Types](https://docs.microsandbox.dev/sdk/typescript/events#types)
- [EventData](https://docs.microsandbox.dev/sdk/typescript/events#eventdata)

Assistant

Responses are generated using AI and may contain mistakes.