---
title: "Choosing a tool and understanding its boundaries"
description: "Positioning, customization, data flow and the conditions for unattended work."
locale: "root"
key: "choosing-and-boundaries"
category: "practice"
order: 6
---

## Limits

- OpenCorvus coordinates compatible models, tools, and executors; it does not make
  arbitrary third-party code compatible or safe.
- Persisted Tasks can be resumed, but no work executes while the owning runtime is
  offline.
- Results depend on model behavior, source access, installed capabilities, and the
  evidence available to the run.
- The project is in active development. Interfaces and packaged integrations may change
  between beta releases.


## Open, yours, controlled, legible

### Open source

MIT licensed, every line published. Self-host it, audit it, fork it.

### Customizable

Swap models, narrow tools, tune permissions, install squads — no forking.

### In your control

Runs on your machine. Tools are scoped per project; irreversible steps ask first.

### Fully legible

Every tool call, argument and result stays in the transcript, readable line by line.

## Compared with the nearest two

This positioning comparison is retained from the previous homepage, with its public-source links. Product capabilities can change; check current product documentation when choosing.

| | [WorkBuddy](https://www.workbuddy.ai/) | [DeepSeek Harness](https://www.deepseek.com/harness/) | OpenCorvus |
| --- | --- | --- | --- |
| Licence | Commercial, token packages | MIT | MIT |
| Runs | Cloud service | Locally | Your machine or your server |
| Starting point | One sentence to a finished output | Plugin kernel, compose it yourself | A whole harness working, then replace any layer |
| Capability unit | Experts and Expert Groups | Plugins | Versioned squads with a digest (121) |
| Getting in | Desktop client | One npx line to a web UI | Installer or source build |

DeepSeek Harness is MIT licensed too, and records a run just as completely; its plugin kernel goes further than ours. The choice is whether you want to assemble a harness or start from one.

## Common questions

### How does this relate to Claude Code or Codex?

Different layer, and they work together. Those are coding sessions bound to one vendor's models; OpenCorvus is the harness — model-agnostic, multi-agent, self-hosted. The desktop app can even discover Claude Code, Codex, Gemini Code, Copilot, and GLM Code already installed on your machine and open one in the current project directory.

### I already use one of those. Do I need this?

Depends what is missing. If you want a better single coding conversation, stay where you are. If you want coordination across many owned tasks, version-pinned expert squads, one permission and evidence trail, and work that survives a restart — that is what this does.

### Does my code leave my machine?

The runtime runs on your machine or your own server, with MIT-licensed, auditable source. Model requests go to your configured provider. A local model can process those requests locally, while browsers, web tools, Model Context Protocol (MCP) services and plugins may still access the network according to their configuration and permissions.

### Which models are supported?

One bundled catalog resolves 87 providers and 2,579 models, local runtimes included. Switching is configuration, not a fork.

### What exactly is an Expert Squad?

An inspectable capability package: roles, workflow, Skills, tools, selection guidance, version, and digest frozen together. A Task pins one exact revision and cannot silently switch it mid-life.

### Is it built on another agent?

The harness and the desktop app are both written in this repository, with no third-party agent engine underneath — that is what makes every layer replaceable. It stands on plenty of open source: Bun, the AI SDK, Solid, Tauri.

### How long is long-horizon, really?

As long as your runtime stays online. Work survives a restart because leases, an event log, and a reconciler own it, not because a process stayed alive. A completed, failed, or cancelled Task reopens on your next message, at a fresh execution occurrence, with the old history intact.

### Does it change itself behind my back?

No. A revision is drafted, validated as a runnable package, and staged. It installs only after you confirm it in your own message, and the receipt you get back is how you restore the previous revision.

### How long can it run unattended?

Only while your runtime is online. This is not a hosted service and it does not promise unbounded autonomy — output depends on the model, the reachable sources, and the available evidence.
