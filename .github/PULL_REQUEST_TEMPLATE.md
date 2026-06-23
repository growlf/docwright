## What does this PR do?

<!-- Brief description of the change -->

## Branch info

- **Base branch:** `develop` (features) or `release/v*.*.*` (milestones) or `main` (releases)
- **Branch naming:** `feat/*`, `plan/*`, `fix/*`, `chore/*`

## Checklists

### For all PRs

- [ ] `npm run lint` passes
- [ ] `npm run test:dispatch` passes
- [ ] No `vscode` imports in `src/dispatch/`
- [ ] Branch is up to date with target base

### For profile / feature PRs

- [ ] All new profile templates include `author-role:` field
- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] NOTICE.md updated (if new attribution required)

### For release PRs (→ main)

- [ ] Version bumped in `VERSION` and `package.json`
- [ ] CHANGELOG.md updated with release notes
- [ ] Release branch named `release/v*.*.*`
