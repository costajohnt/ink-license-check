# Ink License Attribution Report

**Generated:** 2026-04-08
**Tool:** [ink-license-check](https://github.com/costajohnt/ink-license-check) v1.0.0
**Methodology:** Scraped all 200 pages of [GitHub dependents](https://github.com/vadimdemedes/ink/network/dependents?dependent_type=PACKAGE) (5,221 listed packages), batch-checked download counts for 7,955 candidates, verified the 110 with 10k+ monthly downloads against actual npm tarballs.

## Summary

| Metric | Count |
|--------|-------|
| GitHub-listed dependents | 5,221 |
| Candidates download-checked | 7,955 |
| Verified ink users (10k+ downloads) | 47 |
| **Violations** | **40** |
| Properly attributed | 7 |

## Commercial / Third-Party Violations

### @anthropic-ai/claude-code (42.8M monthly downloads)

- **Detection:** Bundled (ink-specific identifiers with React indicators)
- **Missing:** Vadym Demedes, Sindre Sorhus

### @oclif/table (2.4M monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-testing-library`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### gatsby-cli (1.6M monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-spinner`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### @shopify/cli (1.1M monthly downloads)

- **Detection:** Bundled (ink-specific identifiers with React indicators)
- **Missing:** Vadym Demedes, Sindre Sorhus

### @tapjs/reporter (889k monthly downloads)

- **Detection:** Direct dependency (`ink`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### cdktf-cli (816k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-testing-library`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### cline (609k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-picture`, `ink-spinner`, `ink-testing-library`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### gatsby-recipes (338k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-select-input`, `ink-spinner`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### @gitlab/duo-cli (144k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-testing-library`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### treport (103k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-testing-library`)
- **Missing:** Vadym Demedes

### eslint-remote-tester (45k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-testing-library`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### blitz (27k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-spinner`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### cdktn-cli (23k monthly downloads)

- **Detection:** Direct dependency (`ink`, `ink-select-input`, `ink-table`, `ink-spinner`, `ink-use-stdout-dimensions`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### @amplitude/wizard

- **Detection:** Direct dependency (`@inkjs/ui`, `ink`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### @datadog/ai-setup-cli

- **Detection:** Direct dependency (`ink`, `ink-testing-library`)
- **Missing:** Vadym Demedes, Sindre Sorhus

### @prisma/cli

- **Detection:** Bundled (ink-specific identifiers with React indicators)
- **Missing:** Vadym Demedes, Sindre Sorhus

## Ink Ecosystem Violations

These ink extension packages depend on ink but don't include the copyright notice:

| Package | Downloads/mo | Missing |
|---------|-------------|---------|
| ink-gradient | 2.5M | Vadym Demedes |
| ink-table | 1.9M | Vadym Demedes, Sindre Sorhus |
| ink-use-stdout-dimensions | 1.8M | Vadym Demedes, Sindre Sorhus |
| ink-link | 1.0M | Vadym Demedes |
| ink-picture | 585k | Vadym Demedes, Sindre Sorhus |
| ink-big-text | 226k | Vadym Demedes |
| ink-progress-bar | 118k | Vadym Demedes, Sindre Sorhus |
| ink-scroll-view | 88k | Vadym Demedes, Sindre Sorhus |
| element-source | 83k | Vadym Demedes, Sindre Sorhus |
| ink-scroll-list | 75k | Vadym Demedes, Sindre Sorhus |
| ink-box | 60k | Vadym Demedes |
| ink-confirm-input | 56k | Vadym Demedes, Sindre Sorhus |
| ink-chart | 55k | Vadym Demedes, Sindre Sorhus |
| ink-render-string | 27k | Vadym Demedes, Sindre Sorhus |
| ink-checkbox | 27k | Vadym Demedes, Sindre Sorhus |
| ink-divider | 27k | Vadym Demedes, Sindre Sorhus |
| ink-task-list | 25k | Vadym Demedes, Sindre Sorhus |
| ink-syntax-highlight | 24k | Vadym Demedes, Sindre Sorhus |
| fullscreen-ink | 21k | Vadym Demedes, Sindre Sorhus |
| ink-markdown | 20k | Vadym Demedes, Sindre Sorhus |
| difit | 19k | Vadym Demedes, Sindre Sorhus |
| ink-scrollbar | 13k | Vadym Demedes, Sindre Sorhus |
| ccstatusline | 157k | Vadym Demedes, Sindre Sorhus |
| atmn | 93k | Vadym Demedes, Sindre Sorhus |

## Properly Attributed

| Package | Downloads/mo | Attribution In |
|---------|-------------|----------------|
| ink-spinner | 7.3M | LICENSE |
| ink-text-input | 4.4M | LICENSE |
| ink-select-input | 3.1M | LICENSE |
| ink-testing-library | 1.4M | LICENSE |
| @inkjs/ui | 687k | LICENSE |
| pastel | 58k | LICENSE |
| ink-multi-select | 22k | LICENSE |

---

[Ink](https://github.com/vadimdemedes/ink) is MIT licensed by Vadym Demedes and Sindre Sorhus. The MIT license requires that the copyright notice be included in all copies or substantial portions of the software. This report was generated by [ink-license-check](https://github.com/costajohnt/ink-license-check), a zero-dependency CLI tool that downloads npm tarballs and scans for attribution.
