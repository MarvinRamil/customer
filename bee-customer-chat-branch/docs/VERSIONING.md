# Versioning

## How it works

- **`VERSION`** (project root): Single source of truth. Plain text, e.g. `1.0.0`.
- **CI**: Reads `VERSION`, bumps based on commit message keywords, updates `VERSION`, `app.config.js`, and `package.json`.
- **Artifacts**: Each build uploads `VERSION` so you can see the built version.

## Bump rules (commit message)

| Keyword(s) in commit message | Bump type | Example   |
|-----------------------------|-----------|-----------|
| `major`, `major release`    | Major     | 1.0.0 → 2.0.0 |
| `version upgrade`, `minor`  | Minor     | 1.0.0 → 1.1.0 |
| (default)                   | Patch     | 1.0.0 → 1.0.1 |

## How to see the version

1. **In repo**: `cat VERSION`
2. **In CI**: Job logs show "New version: X.Y.Z" and "VERSION file: X.Y.Z"
3. **Artifacts**: Download `VERSION` from the pipeline job

## Keeping versions unique across builds

CI syncs the version back to the repo automatically if `GIT_PUSH_TOKEN` is set:

1. **Settings → CI/CD → Variables** in GitLab
2. Add variable: `GIT_PUSH_TOKEN`
3. Value: a [Project Access Token](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html) or Personal Access Token with `write_repository` scope
4. Check **Masked** and **Protected** (recommended)

CI will commit and push `VERSION`, `app.config.js`, and `package.json` after each successful build. The commit message includes `[skip ci]` so the push does not trigger another pipeline.

**Manual fallback**: If `GIT_PUSH_TOKEN` is not set, commit the updated `VERSION` (from artifacts or logs) after each release so the next build starts from the correct version.
