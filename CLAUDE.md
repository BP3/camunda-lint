# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`camunda-lint` is a Docker image (`bp3global/camunda-lint`, also `ghcr.io/bp3/camunda-lint`) that lints Camunda 8 Web Modeler projects (BPMN + DMN) in CI/CD pipelines. The JavaScript here is the runtime baked into that image; usage docs live in the [GitHub Wiki](https://github.com/BP3/camunda-lint/wiki), not in the README.

## Commands

```bash
npm run lint                 # eslint (incl. prettier as an eslint rule)
npm run lint:fix
npm test                     # mocha ./test/**/*.spec.js  -- see "Tests" below: needs a built Docker image
npx mocha test/integration/integration.spec.js -g "bpmnlint"   # run one integration test group
./build.sh -i camunda-lint-dev:latest -t <token>               # build the image locally (npm install + SBOM + docker build)
```

- Private package `@BP3/bpmnlint-plugin-bpmn-rules` lives on GitHub Packages (see `.npmrc`). `npm install` / `npm ci` and `build.sh` need `GITHUB_TOKEN` set to a classic PAT with `read:packages`.
- CI runs `npm ci`, which fails if `package.json` and `package-lock.json` are out of sync. After editing dependencies/overrides, regenerate the lockfile with `npm install` (or `--package-lock-only`) and commit it.
- Style: prettier with `printWidth: 200`, single quotes, CommonJS. ESLint warns on `no-console`; use `logger.js` (`logger.info/debug/warn/error`) instead of `console`.

## Architecture

Two Node scripts run in sequence inside the container, plus a generated plugin:

1. **`docker-entrypoint.sh`** → if `$CI` is set it `exec`s `/bin/sh` (GitLab CI runner requirement: script commands are piped in); otherwise it runs `node lint.js "$@"`.
2. **`lint.js`** (CLI wrapper; modes `lint`, `bpmnlint`, `dmnlint`, `sbom`, `help`). For each linter type it:
   - looks for `.bpmnlintrc` / `.dmnlintrc` in the project; if missing, writes `defaultLintConfig` into the runner dir;
   - `prepareLintRunner` rewrites the rc as `<rc>Revised` in the runner dir, adds every `plugin:` entry in `extends` to the runner's `package.json` (except `BUNDLED_PLUGINS`), and runs `npm install` at runtime;
   - builds a command line from environment variables and shells out to `lint-runner.js` via `execSync`.
3. **`lint-runner.js`** (yargs CLI; the actual linting). `LINTER_CONFIGS` holds the per-type (`bpmn`/`dmn`) linter, moddle, default config and dependencies. It merges the rc file over `defaultConfig`, globs files, lints each, writes the report (`json`, `html` or `junit` via `--format`), and exits non-zero only when there are **errors** (warnings never fail the run).
4. **`bp3-dynamic-rules/`**: a bpmnlint/dmnlint plugin whose `index.js` scans its own `rules/` directory at `require` time and registers every `.js` file as a rule (severity `warn`), exposed as `plugin:bp3-dynamic-rules/all`. `rules/` is generated and git-ignored: when `--custom-rules-path` is given, `prepareDynamicPlugin` copies the user's rule files in (and optionally `npm install`s their `package.json` deps), and `cleanupDynamicPlugin` removes them in a `finally`.

Environment variables read by `lint.js`: `BPMN_REPORT_FILEPATH`, `DMN_REPORT_FILEPATH`, `REPORT_FORMAT` (default `json`), `BPMN_RULES_PATH`, `DMN_RULES_PATH` (→ `--custom-rules-path`), `CONSOLE_TABLE`; `LOG_LEVEL` is read by `logger.js`.

### Things that are easy to get wrong

- **The project directory is the process working directory** (`WORKING_DIR = process.cwd()` in `lint.js`). The image sets `WORKDIR /project`. `PROJECT_PATH` / `BPMN_PATH` / `DMN_PATH` were deliberately removed (#80) and do nothing. Mounting elsewhere requires `docker run -w <dir>`.
- "No files found" logs a warning but exits 0 and still prints "Linting completed successfully", so a wrong mount or cwd looks like a pass.
- In the image, `lint.js`, `lint-runner.js`, `logger.js`, `package*.json` and `bp3-dynamic-rules/` are copied flat into `/app` (`LINT_RUNNER_PATH` is `/app` if it exists, else the cwd). Runtime-generated files (`.bpmnlintrcRevised`, plugin installs) are written there, not into the user's project.
- `@BP3/bpmnlint-plugin-bpmn-rules` (source: sibling repo `BP3/bpmnlint-plugin-bpmn-rules`) is pinned in `package.json` so Renovate can track it, and installed during the image build. Rule crashes inside it surface as "Info" entries in the report (`rule-error`), not as failures of this tool.
- `package.json` `workspaces` still lists `lint-runner` and `*mnlint-runner` globs that don't exist in this repo; only `bp3-dynamic-rules` is a real workspace.

## Tests

There are no unit tests. `test/integration/integration.spec.js` runs `docker run` against an image and asserts on stdout, using `test/helper.js` (`performContainerTest`). The image is `${IMAGE_NAME:-ghcr.io/bp3/camunda-lint}:${BRANCH_NAME:-main}`, so for local runs build an image first and point the env vars at it:

```bash
IMAGE_NAME=camunda-lint-dev BRANCH_NAME=latest npm run test:integration
```

Fixtures: `test/integration/models/` (one BPMN, one DMN), `test/integration/{bpmn,dmn}-rules/` (custom-rule samples), `test/smoke-test/` (mounted at `/project` for the CI smoke test).

## CI / release

- PRs run `Build branch`: `lint.yml` (`npm ci` + `npm run lint`) then `build-image.yml` (build, push to ghcr.io tagged with the sanitised branch name, then `test-image`: smoke test + `npm run test:integration` against that tag).
- Pushes to `main` build the image tagged `main`.
- A release is cut by publishing a GitHub Release: `release.yml` retags the existing `main` image with the release tag (and `latest`) and pushes to GitHub Container Registry and Docker Hub. It does not rebuild.
- Renovate (`renovate.json`) manages dependencies. Don't name your own branches `renovate/*`; Renovate treats that prefix as its own and may overwrite or delete them. Access to the private package uses the `GH_PACKAGES_TOKEN` secret configured in the Mend portal.
