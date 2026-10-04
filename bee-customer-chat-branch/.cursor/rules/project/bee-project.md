---
description: "Bee Customer App – project overview, feature-based architecture, import rules, and strict restrictions (build files, env vars)."
alwaysApply: true
---

# Bee Customer App – Project Rules

Expo/React Native app (TypeScript, Expo Router). Code is organized by **business features**, not technical layers.

## Tech stack

- Expo ~54, React Native 0.81.5, TypeScript (strict)
- Expo Router (file-based), React Navigation, React Context
- Styling: StyleSheet + theme

## Feature-based architecture (strict)

### Directory layout

- `app/` – Routes only (Expo Router screens).
- `features/[feature-name]/` – Feature modules (auth, bookings, history, profile, tracking).
- `shared/` – Cross-feature: components, hooks, services, types.
- `context/` – Global providers if needed.

### Feature module shape

Each feature in `features/` MUST have:

```
features/[feature-name]/
  ├── components/
  ├── hooks/
  ├── services/
  ├── types.ts
  └── index.ts   # REQUIRED – public API
```

### What goes where

- **Feature folder**: Components/hooks/services/types used ONLY in that feature.
- **Shared folder**: UI primitives, layout components, shared hooks, apiClient/storage, common types, theme, utils.

### Public API (index.ts)

- Every feature MUST have `index.ts` exporting public components, hooks, services, types.
- Do NOT export internal helpers or private implementation.

### Import rules

- From features: `import { X } from '@/features/dispatches'` (always via index).
- From shared: `import { Y } from '@/shared/components/Y'`.
- Never import feature internals: `@/features/dispatches/components/...` – use the feature index instead.

### When adding code

1. Feature-only? → `features/[feature-name]/`.
2. Used by multiple features? → `shared/`.
3. Route/screen? → `app/`.
4. Add/update `index.ts` for any feature you change.
5. Keep features as self-contained as possible.

## TypeScript & files

- Strict TypeScript; interfaces for object shapes; avoid `any` (use `unknown` if needed).
- Types: shared → `shared/types/` or root `types.ts`; feature-only → `features/[feature]/types.ts`; export from feature `index.ts` if used elsewhere.
- Files: PascalCase for components, kebab-case for utils, camelCase for hooks.
- **Documentation**: All README and project docs go in `docs/` (see `docs/documentation.md` rule). Plans in `docs/plans/`, changelog in `docs/changelog/`. Root `README.md` only at project root for repo overview.
- Scripts in `scripts/*.sh`; sample JSON in appropriate dirs (e.g. `data/`, `config/`).

## Build files – DO NOT MODIFY

- **Never** edit `ios/` or `android/` directly.
- Use `app.config.js` / `app.json`, Expo config plugins, and `package.json` for native/config changes.

## Environment variables

When adding or using `EXPO_PUBLIC_*` or other env vars:

1. Add to active `.env` with comment.
2. Add to `.env.example` (or `.env.template`) with placeholder + comment.
3. Document in relevant docs (e.g. `docs/ENVIRONMENT_VARIABLES.md`).

Format: `VARIABLE_NAME=value` with a short comment above.

## Code quality

- JSDoc on functions/hooks (purpose, params, returns); inline comments for non-obvious logic.
- Small, focused functions; DRY; follow existing patterns and ESLint (expo config).

## When making changes

- Keep TypeScript strict; support iOS, Android, Web where relevant.
- Follow feature architecture and import rules; create/update feature `index.ts`.
- Enforce safe areas on screens (see `app/safe-areas.md` when editing `app/`).
- Enforce env var updates when adding new variables.
- Follow the code-change workflow (see `workflow/code-change-workflow.md`) for features/plans.

For full examples (components, hooks, safe area patterns, workflow), see `.cursorrules` or `docs/CURSOR_RULES.md`.
