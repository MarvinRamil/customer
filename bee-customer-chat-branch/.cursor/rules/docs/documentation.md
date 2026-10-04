---
description: "Where to put documentation and README .md files – docs/, docs/plans/, docs/changelog/, root README.md."
alwaysApply: true
---

# Documentation placement

All project documentation and README-style `.md` files MUST go in the following locations.

## Where to put docs

| Content | Location | Examples |
|--------|----------|----------|
| **Project docs** (API, setup, env, guides) | `docs/` | `docs/API.md`, `docs/ENVIRONMENT_VARIABLES.md`, `docs/CURSOR_RULES.md`, `docs/COMMIT_MESSAGE.md`, `docs/README.md`, `docs/setup.md` |
| **Implementation plans** (phased plans, design) | `docs/plans/` | `docs/plans/[feature-name]-implementation-plan.md`, `docs/plans/phase6-code-review.md` |
| **Changelog entries** | `docs/changelog/` | `docs/changelog/2025-12-24-bookingAndMaps.md` |
| **Features to implement** (planned/requested features) | `docs/features-to-implement/` | `docs/features-to-implement/user-registration.md` |
| **Root project readme** | `README.md` (project root only) | One file: high-level overview, quick start, link to `docs/` |

## Rules

- **Do NOT** put new README or guide `.md` files in random folders (e.g. `features/README.md`, `shared/README.md`) unless they are the single root `README.md`.
- **Do** put all setup, API, environment, commit, and Cursor rules docs in `docs/`.
- **Do** put implementation/feature plans in `docs/plans/` with a clear name (e.g. `[feature]-implementation-plan.md`).
- **Do** put changelog entries in `docs/changelog/` with a date-prefixed filename (e.g. `YYYY-MM-DD-topic.md`).
- **Do** put planned or requested features in `docs/features-to-implement/` (one `.md` per feature).
- **Naming**: Use kebab-case for doc filenames (e.g. `environment-variables.md`). UPPERCASE is allowed for well-known names (e.g. `README.md`, `API.md`, `CHANGELOG.md` in root or docs).

## Summary

- General documentation → `docs/`
- Plans → `docs/plans/`
- Changelog → `docs/changelog/`
- Features to implement → `docs/features-to-implement/`
- Repo overview → root `README.md` only
