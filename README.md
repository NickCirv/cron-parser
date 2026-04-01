![Banner](banner.svg)

# cron-parser

Parse, describe, and preview cron expressions in plain English. Zero external dependencies.

```
cron-parser "0 9 * * 1-5"
→ At 9:00 AM, Monday through Friday
   Next: in 19 hours (2026-03-04 09:00:00)
```

## Install

```bash
npm install -g cron-parser
```

Or run without installing:

```bash
npx cron-parser "*/15 * * * *"
```

## Usage

```bash
# Describe an expression
cron-parser "0 9 * * 1-5"

# Show next N execution times (default: 5)
cron-parser "*/15 * * * *" --next 5

# Next runs from a specific date
cron-parser "0 9 * * 1-5" --from "2026-06-01"

# Use a specific timezone
cron-parser "0 9 * * *" --tz "America/New_York" --next 3

# Output as JSON
cron-parser "0 9 * * 1-5" --json

# Validate an expression (exit 0=valid, 1=invalid)
cron-parser --validate "0 9 * * 1-5"

# Show common presets
cron-parser --list

# Interactive expression builder
cron-parser --interactive
```

Both `cron-parser` and `cronp` are available as commands.

## Examples

| Expression      | Description                                      |
|-----------------|--------------------------------------------------|
| `* * * * *`     | Every minute                                     |
| `*/15 * * * *`  | Every 15 minutes                                 |
| `0 * * * *`     | Every hour                                       |
| `0 */4 * * *`   | Every 4 hours                                    |
| `0 9 * * *`     | Daily at 9:00 AM                                 |
| `0 9 * * 1-5`   | At 9:00 AM, Monday through Friday                |
| `0 9-17 * * 1-5`| At minute 0, between 9:00 AM and 5:00 PM, Mon–Fri |
| `30 6 * * 0`    | At 6:30 AM, only on Sunday                       |
| `0 0 1 * *`     | At midnight, on the 1st of every month           |
| `0 0 1 1 *`     | At midnight, on January 1st every year           |

## Cron Syntax

5-field standard cron format: `minute hour day-of-month month day-of-week`

| Token   | Meaning           |
|---------|-------------------|
| `*`     | Every value       |
| `*/n`   | Every n units     |
| `n`     | Specific value    |
| `n-m`   | Range n to m      |
| `n,m,o` | List of values    |
| `n-m/s` | Range with step s |

## Special Aliases

| Alias              | Equivalent     | Description                         |
|--------------------|----------------|-------------------------------------|
| `@yearly`          | `0 0 1 1 *`    | Once a year, January 1st            |
| `@annually`        | `0 0 1 1 *`    | Same as @yearly                     |
| `@monthly`         | `0 0 1 * *`    | Once a month, first day             |
| `@weekly`          | `0 0 * * 0`    | Once a week, Sunday midnight        |
| `@daily`           | `0 0 * * *`    | Once a day, midnight                |
| `@midnight`        | `0 0 * * *`    | Same as @daily                      |
| `@hourly`          | `0 * * * *`    | Once an hour                        |
| `@reboot`          | —              | At system startup                   |

## JSON Output

```bash
cron-parser "0 9 * * 1-5" --next 3 --json
```

```json
{
  "expression": "0 9 * * 1-5",
  "description": "At 9:00 AM, Monday through Friday",
  "valid": true,
  "timezone": "America/New_York",
  "from": "2026-03-03T09:00:00.000Z",
  "next": [
    {
      "relative": "in 19 hours",
      "formatted": "2026-03-04 09:00:00",
      "ts": "2026-03-04T14:00:00.000Z"
    }
  ]
}
```

## Validation in Scripts

```bash
if cron-parser --validate "$MY_CRON_EXPR"; then
  echo "Expression is valid"
else
  echo "Expression is invalid"
fi
```

## Requirements

- Node.js >= 18
- Zero external dependencies

## License

MIT
