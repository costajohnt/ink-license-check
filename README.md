# ink-license-check

Zero-dependency Node.js CLI that checks npm packages for missing [Ink](https://github.com/vadimdemedes/ink) (MIT license) attribution.

Ink is MIT licensed by [Vadym Demedes](https://github.com/vadimdemedes) and [Sindre Sorhus](https://github.com/sindresorhus). The MIT license requires that the copyright notice be included in all copies or substantial portions of the software. This tool helps identify packages that use Ink without proper attribution.

See the [related discussion](https://github.com/vadimdemedes/ink/discussions/924) on the Ink repo.

## Install

```
npm install -g ink-license-check
```

Or run directly with npx:

```
npx ink-license-check <package...>
```

## Usage

```
ink-license-check <package...> [options]

Options:
  --json          Output results as JSON
  -d, --downloads Include monthly npm download counts
  -h, --help      Show this help message
  -v, --version   Show version number
```

## Examples

Check a single package:

```
$ ink-license-check some-cli-tool

ink-license-check v1.0.0

  PASS  some-cli-tool@2.1.0
        Uses ink (dependency), attribution found in LICENSE.md

No violations found in 1 package
```

Check multiple packages with download counts:

```
$ ink-license-check pkg-a pkg-b -d

ink-license-check v1.0.0

  PASS  pkg-a@1.0.0  (12.4k monthly downloads)
        Uses ink (dependency), attribution found in LICENSE

  FAIL  pkg-b@3.2.0  (1.2M monthly downloads)
        Uses ink (bundled), missing attribution
        Evidence: require("ink") found in dist/cli.js
        Missing: Vadym Demedes, Sindre Sorhus

1 violation found in 2 packages
```

JSON output for scripting:

```
$ ink-license-check some-package --json
```

## How It Works

For each package:

1. Downloads the npm tarball from the registry
2. Detects Ink usage via two methods:
   - **Dependency check**: looks for `ink`, `ink-*`, `@inkjs/*`, or `pastel` in package.json dependencies
   - **Bundled code scan**: scans JS files for `require("ink")`, `from "ink"`, and Ink-specific hooks like `useInput`, `useApp`, etc.
3. If Ink usage is detected, checks for proper attribution:
   - Scans LICENSE, NOTICE, and THIRD_PARTY files for copyright holder names
   - Scans JS file license comment headers for attribution

## Exit Codes

- `0` — no violations found
- `1` — one or more violations found
- `2` — usage error (no packages provided, unknown flags)

## License

MIT
