# Changelog

All notable changes to this project are documented here. The format is loosely
based on [Keep a Changelog](https://keepachangelog.com/).

## [1.1.1](https://github.com/costajohnt/ink-license-check/compare/v1.1.0...v1.1.1) (2026-07-25)


### Bug Fixes

* definition-scan module-map bundles, document minification gap, add release pipeline ([af9e97b](https://github.com/costajohnt/ink-license-check/commit/af9e97b441a25f5bc17a9a34bd78d3f3f969eaf5))

## 1.1.0

Corrects the core "violation" definition, which produced false positives that
flagged real, compliant packages. This is a semantic change to what the tool
reports.

### Changed

- **Dependency declarations and imports are no longer flagged.** A package that
  merely lists `ink`/`ink-*`/`@inkjs/*`/`pastel` in its dependencies — or
  references Ink with a live `import`/`require "ink"` — distributes no Ink source
  in its own tarball (npm resolves the dependency at install time). These now
  report a distinct `n/a` (not bundled) status instead of `FAIL`.
  `devDependencies` and `peerDependencies` are dropped from detection entirely,
  since neither is shipped.
- **Bundling is detected from hook DEFINITIONS, not usage.** Only packages that
  actually bundle/vendor Ink's source can be a violation, and that is now
  detected by finding Ink's hooks in definition form (e.g. `function useInput(`).
  An ordinary Ink CLI that imports and calls `useInput`/`useApp` defines nothing,
  so it is no longer misclassified as a bundler and can never FAIL on that basis.
- **Full-file attribution scan.** Attribution is now searched across the entire
  contents of each file, not just the top header. This finds end-of-file legal
  comments produced by esbuild's default `--legal-comments=eof` and by webpack
  license plugins (e.g. `@shopify/cli`), which the header-only scan missed.
- **Attribution requires Vadym Demedes; Sindre Sorhus is informational.** Vadym
  (Vadim) Demedes is named in every version of Ink's LICENSE; Sindre Sorhus was
  added only in Ink 7.x (2.x-6.x name Vadym alone). Requiring both would falsely
  flag a package that correctly vendors, say, ink@4. So a pass requires only the
  always-present holder; a missing Sindre is surfaced as a note. The direction of
  error is always false-negative (a miss), never a false accusation.
- **PAX tarball support.** Long file paths stored in PAX extended headers
  (`x`/`g` `path=` records) are now resolved instead of being silently truncated
  to 100 chars (which could drop a `.js` extension and hide a file from both
  scans).

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
