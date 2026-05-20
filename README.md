# DocWright

**A documentation workbench for LLM-assisted project management.**

DocWright is a portable vault that combines OpenCode configuration, a lifecycle workflow (proposals → plans → docs), and SOP templates into a self-contained project starter. Fork it, configure your model provider, and start managing work through structured documents — with an LLM agent as your assistant.

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
├── proposals/          # Ideas and change requests (approved: false)
├── proposals/approved/ # Human-approved proposals → plan creation
├── plans/              # Implementation plans with phases and steps
├── plans/completed/    # Completed or canceled plans
├── docs/               # Generated documentation and SOPs
├── templates/          # Markdown templates for proposals, plans, SOPs
├── scripts/            # Git hooks, test suite, architecture verification
└── .opencode/          # OpenCode agents, rules, and skills
```

## The Lifecycle

```
proposals/ → approved/ → plans/ → completed/ → docs/
                                ↘ canceled (no docs)
```

All changes flow through this state machine. See `docs/SOPs/order-of-work-lifecycle.md` for the full guide.

## License

MIT — free to use, fork, and adapt.
