# ink-license-check

Zero-dependency Node.js CLI that checks npm packages for missing [Ink](https://github.com/vadimdemedes/ink) (MIT license) attribution.

Ink is MIT licensed by [Vadym Demedes](https://github.com/vadimdemedes) and [Sindre Sorhus](https://github.com/sindresorhus). The MIT license requires that the copyright notice be included in all copies or substantial portions of the software. This tool helps identify packages that use Ink without proper attribution.

See the [related discussion](https://github.com/vadimdemedes/ink/discussions/924) on the Ink repo.

## Install

This package is not published to npm yet. Install it from GitHub.

Run directly without installing:

```
npx github:costajohnt/ink-license-check <package...>
```

Or clone and link it for a global `ink-license-check` command:

```
git clone https://github.com/costajohnt/ink-license-check.git
cd ink-license-check
npm link
```

It has zero runtime dependencies, so there is nothing to install for the tool
itself. (`npm install` only pulls the dev-time linter.)

## Usage

```
ink-license-check <package...> [options]

Options:
  --json                 Output results as JSON
  --report               Output a markdown report (for posting on GitHub)
  -d, --downloads        Include monthly npm download counts
  --min-downloads <n>    Only report on packages with at least n monthly downloads
                         (implies --downloads)
  -h, --help             Show this help message
  -v, --version          Show version number
```

## Examples

Check a single package that bundles Ink and attributes it correctly:

```
$ ink-license-check some-cli-tool

ink-license-check v1.1.0

  PASS  some-cli-tool@2.1.0
        Uses ink (bundled), attribution found in dist/cli.js

No violations found in 1 package
```

Check multiple packages with download counts:

```
$ ink-license-check pkg-a pkg-b -d

ink-license-check v1.1.0

  n/a   pkg-a@1.0.0  (12.4k monthly downloads)
        Uses ink via dependency (not bundled) — attribution obligation falls on install, not this tarball

  FAIL  pkg-b@3.2.0  (1.2M monthly downloads)
        Uses ink (bundled), missing attribution
        Evidence: ink hooks defined in bundled source: useInput, useApp
        Missing: Vadym Demedes

1 violation found in 2 packages
```

`n/a` means the package declares or imports Ink but does not ship Ink's source
in its own tarball, so it has no attribution obligation. Only packages that
bundle/vendor Ink's source can be a `FAIL`.

Generate a markdown report for high-download packages:

```
$ ink-license-check pkg-a pkg-b pkg-c --report --min-downloads 100000
```

JSON output for scripting:

```
$ ink-license-check some-package --json
```

## How It Works

For each package:

1. Downloads the npm tarball from the registry.
2. Classifies how it relates to Ink, from least to most significant:
   - **Declares** `ink`, `ink-*`, `@inkjs/*`, or `pastel` in `dependencies`. npm
     does not copy a dependency's source into this tarball, so this is
     informational only. (`devDependencies` and `peerDependencies` are ignored
     entirely, since neither is shipped.)
   - **References** Ink via a live `require("ink")` / `from "ink"` in the shipped
     JS. This is still an external module reference resolved at install time, so
     it is also informational.
   - **Bundles** Ink's source into the published files (vendored, or inlined by a
     bundler such as esbuild/webpack), detected by finding Ink's hooks in
     **definition** form (e.g. `function useInput(`). A consumer only imports and
     calls the hooks, never defines them, so this distinguishes a real bundle
     from ordinary usage. This is the only case that owes attribution.
3. For a bundling package, checks for attribution by scanning the **entire**
   contents of LICENSE/NOTICE/THIRD_PARTY files and JS files (not just headers,
   so end-of-file bundler legal comments are found). A pass requires Vadym
   (Vadim) Demedes, who is named in every version of Ink's LICENSE; Sindre Sorhus
   (added in Ink 7.x) is reported as an informational note when absent, never as
   a violation, so a package vendoring an older Ink is not falsely accused.

A declares/references-only package reports `n/a` (not bundled) and never fails.

## Exit Codes

- `0` — no violations found (includes `n/a` dependency-only packages)
- `1` — one or more violations found
- `2` — usage error or package check failures (network errors, etc.)

## License

MIT
