# Changelog

All notable changes to this project are documented here. The format is loosely
based on [Keep a Changelog](https://keepachangelog.com/).

## 1.1.0

Corrects the core "violation" definition, which produced false positives that
flagged real, compliant packages. This is a semantic change to what the tool
reports.

### Changed

- **Dependency declarations are no longer flagged.** A package that merely lists
  `ink`/`ink-*`/`@inkjs/*`/`pastel` in its dependencies — or references Ink with
  a live `import`/`require "ink"` — distributes no Ink source in its own tarball
  (npm resolves the dependency at install time). These now report a distinct
  `n/a` (not bundled) status instead of `FAIL`. `devDependencies` and
  `peerDependencies` are dropped from detection entirely, since neither is
  shipped. Only packages that actually **bundle/vendor Ink's source** (its API
  implementation present inline) can be a violation.
- **Full-file attribution scan.** Attribution is now searched across the entire
  contents of each file, not just the top header. This finds end-of-file legal
  comments produced by esbuild's default `--legal-comments=eof` and by webpack
  license plugins (e.g. `@shopify/cli`), which the header-only scan missed.
- **Both copyright holders required.** Ink's LICENSE names both Vadym Demedes and
  Sindre Sorhus, so a pass now requires both. Previously the pass/fail decision
  keyed only on Vadym, so a result could `PASS` while still listing Sindre as a
  missing holder.

### Added

- Concurrency cap (8) on tarball fetches so a large package list no longer opens
  every registry connection at once.
- GitHub Actions CI running the test suite and linter on Node 20 and 22.
- `xo` linter with a `lint` script.

### Removed

- The committed `report.md`, which named real orgs as violators based on the
  false positives fixed here.

## 1.0.0

- Initial release: download npm tarballs and check for missing Ink MIT
  attribution.
