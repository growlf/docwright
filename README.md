# DocWright

**A documentation workbench for LLM-assisted project management.**

DocWright is a portable vault that combines OpenCode configuration, a **profile-driven document lifecycle engine**, and SOP templates into a self-contained project starter. Fork it, configure your model provider, and start managing work through structured documents — with an LLM agent as your assistant.

Two profiles ship in the box:

| Profile | Purpose | States |
|---------|---------|--------|
| **doc-lifecycle** | Proposals, plans, SOPs | proposal → plan → completed / canceled |
| **infra-topology** | Network devices, services, segments | planned → active → decommissioned |

Both are illustrative, not prescriptive. You can define your own profiles for any domain that benefits from structured markdown moving through defined states.

## Quick Start

```bash
cp .env.example .env       # Set OPCODE_USER_NAME and OPCODE_USER_EMAIL
bash scripts/install-hooks.sh  # Install pre-commit validation
# Edit opencode.jsonc to add your LLM provider
# Then: create your first proposal in proposals/
```

## Getting Up and Running on Older Hardware

If you're setting up a local LLM to work with DocWright on older hardware (e.g., Intel NUC Skull Canyon), check out:

**[growlf/intel_nuc_skullcanyon_ollama_with_gpu](https://github.com/growlf/intel_nuc_skullcanyon_ollama_with_gpu)**

This guide covers Ollama setup with GPU acceleration on aging hardware — a common path for running DocWright's LLM agent locally without cloud API dependency. It walks through Iris Xe/Arc GPU configuration, container setup, and performance tuning for smaller models that still deliver useful agent assistance.

## Project Structure

```
├── .docworkbench/           # Profile definitions
│   ├── doc-lifecycle/       #   Proposals, plans, SOPs
│   └── infra-topology/      #   Devices, services, segments
├── proposals/               # Ideas and change requests (approved: false)
├── proposals/approved/      # Human-approved proposals → plan creation
├── plans/                   # Implementation plans with phases and steps
├── plans/completed/         # Completed or canceled plans
├── docs/                    # Generated documentation and SOPs
├── templates/               # Generic templates
├── scripts/                 # Git hooks, test suite, architecture verification
└── .opencode/               # OpenCode agents, rules, and skills
```

## The Lifecycle

```
proposals/ → approved/ → plans/ → completed/ → docs/
                                ↘ canceled (no docs)
```

All changes flow through this state machine. See `docs/SOPs/order-of-work-lifecycle.md` for the full guide.

## License

MIT — free to use, fork, and adapt.
