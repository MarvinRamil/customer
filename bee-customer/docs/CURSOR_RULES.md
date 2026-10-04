# Cursor Rules – Bee Customer App

This project uses [Cursor Project Rules](https://cursor.com/docs/context/rules) for Agent (Chat). Rules are stored in `.cursor/rules` as **`.md`** files and organized by folder. All rules are set to **Always Apply**.

## Official docs

- **Rules overview**: [cursor.com/docs/context/rules](https://cursor.com/docs/context/rules)
- Rule types: Always Apply, Apply Intelligently, Apply to Specific Files, Apply Manually
- Rule format: `.md` (or `.mdc`) with optional frontmatter (`description`, `globs`, `alwaysApply`). This project uses `.md` only.

## Folder structure

Rules are organized in folders by domain:

```
.cursor/rules/
  api/
    tanstack-query.md        # Always Apply – use TanStack Query for all API calls
  app/
    safe-areas.md            # Always Apply – safe area handling for screens/tab bars
  docs/
    documentation.md        # Always Apply – where to put DOC/README .md files
  project/
    bee-project.md           # Always Apply – overview, feature-based architecture, restrictions
  validation/
    zod-validation.md        # Always Apply – use Zod for all form validation
  workflow/
    code-change-workflow.md  # Always Apply – phased plans, docs/plans, approval
```

## Rule files

All rules use **Always Apply** and are included in every chat session.

| Rule | Path |
|------|------|
| **TanStack Query** | `api/tanstack-query.md` – use TanStack Query for all API data fetching |
| **Zod Validation** | `validation/zod-validation.md` – use Zod for all form validation |
| **Bee project** | `project/bee-project.md` |
| **Safe areas** | `app/safe-areas.md` |
| **Documentation** | `docs/documentation.md` – where to put DOC/README and other .md files |
| **Code change workflow** | `workflow/code-change-workflow.md` |

## Adding or editing rules

1. **Cursor UI**: **Cursor Settings → Rules, Commands** → Project Rules → add or edit.
2. **Files**: Create or edit `.md` under `.cursor/rules/`, using folders (e.g. `app/`, `workflow/`) for grouping.
3. **Frontmatter**: In each `.md` rule, use `description` and `alwaysApply: true` so the rule is always applied.
4. **Manual use**: In chat, mention a rule with `@rule-name` (e.g. `@safe-areas`) to apply it manually.

## Legacy `.cursorrules`

The root `.cursorrules` file is still supported by Cursor but is [legacy and will be deprecated](https://cursor.com/docs/context/rules#cursorrules). This repo uses `.cursor/rules/` as the source of truth. For full, long-form conventions and examples, `.cursorrules` remains as reference; new and updated guidance lives in `.cursor/rules/`.

## Best practices (from Cursor docs)

- Keep each rule under ~500 lines; split into multiple rules if needed.
- Use concrete examples or `@filename` references instead of pasting large blocks.
- Scope rules with `globs` so they apply only where relevant.
- Commit `.cursor/rules/` to git so the team shares the same rules.
