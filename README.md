<div align="center">

# cron-parser

**Translate any cron expression into plain English — with next-run previews, validation, and an interactive builder. Zero dependencies.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?labelColor=0B0A09)](LICENSE)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?labelColor=0B0A09)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?labelColor=0B0A09)](package.json)

</div>

## Install

```bash
npx github:NickCirv/cron-parser "0 9 * * 1-5"
```

Both `cron-parser` and `cronp` are available as commands after cloning:

```bash
git clone https://github.com/NickCirv/cron-parser.git
cd cron-parser
node index.js "0 9 * * 1-5"
```

## Usage

```bash
# Describe an expression in plain English
npx github:NickCirv/cron-parser "0 9 * * 1-5"
# → At 9:00 AM, Monday through Friday
#   Next: in 19 hours (2026-06-20 09:00:00)

# Show next N execution times
npx github:NickCirv/cron-parser "*/15 * * * *" --next 5

# Next runs from a specific date
npx github:NickCirv/cron-parser "0 9 * * 1-5" --from "2026-07-01"

# Use a specific timezone
npx github:NickCirv/cron-parser "0 9 * * *" --tz "America/New_York" --next 3

# Output as JSON
npx github:NickCirv/cron-parser "0 9 * * 1-5" --json

# Validate an expression (exit 0 = valid, 1 = invalid)
npx github:NickCirv/cron-parser --validate "0 9 * * 1-5"

# Show common presets
npx github:NickCirv/cron-parser --list

# Interactive expression builder
npx github:NickCirv/cron-parser --interactive
```

| Flag | Description |
|------|-------------|
| `--next [n]` | Show next N execution times (default: 5) |
| `--from "YYYY-MM-DD"` | Calculate next runs from this date |
| `--tz "Region/City"` | Display times in a specific timezone |
| `--json` | Machine-readable JSON output |
| `--validate` | Validate only; exits 0 (valid) or 1 (invalid) |
| `--list` | Print common presets |
| `--interactive` | Step-by-step expression builder |

## What it does

Parses any standard 5-field cron expression (plus `@yearly`, `@daily`, `@reboot` aliases) and describes it in plain English. Calculates the next N scheduled run times with relative labels ("in 19 hours"). Validates expressions for use in scripts with a standard exit code. Works entirely offline with no external dependencies — only Node.js built-ins.

---
<sub>Zero dependencies · Node ≥18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
