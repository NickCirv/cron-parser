#!/usr/bin/env node
// cron-parser — zero external dependencies
// Built-ins only: process, readline

// ── ANSI colors ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};
const noColor = !process.stdout.isTTY || process.env.NO_COLOR;
const c = (code, str) => noColor ? str : `${code}${str}${C.reset}`;

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_LONG   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS_LONG = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec'];

const FIELD_LIMITS = [
  { name: 'minute',     min: 0, max: 59 },
  { name: 'hour',       min: 0, max: 23 },
  { name: 'day',        min: 1, max: 31 },
  { name: 'month',      min: 1, max: 12 },
  { name: 'weekday',    min: 0, max: 7  }, // 7 = Sunday alias
];

const ALIASES = {
  '@yearly':   '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly':  '0 0 1 * *',
  '@weekly':   '0 0 * * 0',
  '@daily':    '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly':   '0 * * * *',
  '@reboot':   null, // special
};

const PRESETS = [
  { expr: '* * * * *',    desc: 'Every minute' },
  { expr: '*/5 * * * *',  desc: 'Every 5 minutes' },
  { expr: '*/15 * * * *', desc: 'Every 15 minutes' },
  { expr: '*/30 * * * *', desc: 'Every 30 minutes' },
  { expr: '0 * * * *',    desc: 'Every hour' },
  { expr: '0 */4 * * *',  desc: 'Every 4 hours' },
  { expr: '0 */6 * * *',  desc: 'Every 6 hours' },
  { expr: '0 */12 * * *', desc: 'Every 12 hours' },
  { expr: '0 0 * * *',    desc: 'Daily at midnight' },
  { expr: '0 9 * * *',    desc: 'Daily at 9:00 AM' },
  { expr: '0 9 * * 1-5',  desc: 'Weekdays at 9:00 AM' },
  { expr: '0 17 * * 1-5', desc: 'Weekdays at 5:00 PM' },
  { expr: '0 0 * * 0',    desc: 'Every Sunday at midnight' },
  { expr: '0 9 * * 1',    desc: 'Every Monday at 9:00 AM' },
  { expr: '0 0 1 * *',    desc: 'First of every month at midnight' },
  { expr: '0 0 1 1 *',    desc: 'Every year on January 1st at midnight' },
  { expr: '0 0 * * 6,0',  desc: 'Every weekend at midnight' },
  { expr: '30 6 * * 0',   desc: 'Every Sunday at 6:30 AM' },
  { expr: '0 9-17 * * 1-5', desc: 'Top of every hour, 9 AM–5 PM, Mon–Fri' },
  { expr: '0 0 15 * *',   desc: 'Every month on the 15th at midnight' },
];

// ── Field parser ──────────────────────────────────────────────────────────────
function parseField(str, min, max) {
  const values = new Set();

  if (str === '*') {
    for (let i = min; i <= max; i++) values.add(i);
    return { type: 'all', values, raw: str };
  }

  const parts = str.split(',');
  for (const part of parts) {
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const s = parseInt(step, 10);
      if (isNaN(s) || s < 1) throw new Error(`Invalid step value: ${step}`);
      let start = min, end = max;
      if (range !== '*') {
        if (range.includes('-')) {
          const [a, b] = range.split('-').map(Number);
          start = a; end = b;
        } else {
          start = parseInt(range, 10);
        }
      }
      if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range: ${range}`);
      for (let i = start; i <= end; i += s) values.add(i);
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (isNaN(a) || isNaN(b)) throw new Error(`Invalid range: ${part}`);
      for (let i = a; i <= b; i++) values.add(i);
    } else {
      const n = parseInt(part, 10);
      if (isNaN(n)) throw new Error(`Invalid value: ${part}`);
      values.add(n);
    }
  }

  // validate bounds
  for (const v of values) {
    if (v < min || v > max) throw new Error(`Value ${v} out of range [${min}-${max}]`);
  }

  const type = str === '*' ? 'all'
    : values.size === 1 ? 'specific'
    : 'complex';

  return { type, values, raw: str };
}

// ── Cron expression parser & validator ───────────────────────────────────────
function parseCron(expr) {
  // handle @alias
  if (expr.startsWith('@')) {
    if (expr === '@reboot') return { isReboot: true, raw: expr };
    if (ALIASES[expr]) expr = ALIASES[expr];
    else throw new Error(`Unknown alias: ${expr}`);
  }

  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expected 5 fields, got ${parts.length}`);

  const [minuteRaw, hourRaw, dayRaw, monthRaw, weekdayRaw] = parts;
  return {
    minute:  parseField(minuteRaw,  0, 59),
    hour:    parseField(hourRaw,    0, 23),
    day:     parseField(dayRaw,     1, 31),
    month:   parseField(monthRaw,   1, 12),
    weekday: parseField(weekdayRaw, 0, 7),
    raw: expr,
    isReboot: false,
  };
}

function validateCron(expr) {
  try {
    parseCron(expr);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Human description ─────────────────────────────────────────────────────────
function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function formatTime(minuteField, hourField) {
  const hrs = [...hourField.values].sort((a,b)=>a-b);
  const mins = [...minuteField.values].sort((a,b)=>a-b);

  const fmtTime = (h, m) => {
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const mm   = String(m).padStart(2,'0');
    return `${h12}:${mm} ${ampm}`;
  };

  if (minuteField.raw === '*' && hourField.raw === '*') return 'every minute';
  if (minuteField.raw === '*' && hourField.raw !== '*') {
    if (hrs.length === 1) return `every minute of ${fmtTime(hrs[0],0).replace(':00','')} hour`;
    return `every minute`;
  }

  const mRaw = minuteField.raw;
  const hRaw = hourField.raw;

  // step minute e.g. */15
  if (mRaw.startsWith('*/') && hRaw === '*') {
    const step = mRaw.slice(2);
    return `every ${step} minute${step==='1'?'':'s'}`;
  }
  if (mRaw.startsWith('*/') && hRaw !== '*') {
    const step = mRaw.slice(2);
    return `every ${step} minute${step==='1'?'':'s'}`;
  }

  // step hour e.g. 0 */4
  if (mRaw === '0' && hRaw.startsWith('*/')) {
    const step = hRaw.slice(2);
    return `every ${step} hour${step==='1'?'':'s'}`;
  }

  // range hour e.g. 0 9-17
  if (hRaw.includes('-') && mRaw === '0') {
    const [a,b] = hRaw.split('-').map(Number);
    return `at minute 0, between ${fmtTime(a,0)} and ${fmtTime(b,0)}`;
  }

  // specific hour + specific minute
  if (hrs.length === 1 && mins.length === 1) {
    return `at ${fmtTime(hrs[0], mins[0])}`;
  }

  // multiple specific times
  if (mins.length === 1) {
    const times = hrs.map(h => fmtTime(h, mins[0])).join(', ');
    return `at ${times}`;
  }

  return `at minute ${mins.join(',')} past hour ${hrs.join(',')}`;
}

function describeWeekday(wField) {
  const raw = wField.raw;
  if (raw === '*') return null;

  // normalize 7→0
  const vals = [...wField.values].map(v => v === 7 ? 0 : v).sort((a,b)=>a-b);
  const unique = [...new Set(vals)];

  if (unique.length === 7) return null;
  if (unique.length === 1) return `only on ${DAYS_LONG[unique[0]]}`;

  // detect range
  if (raw.includes('-') && !raw.includes(',')) {
    const [a,b] = raw.split('-').map(n => n === '7' ? 0 : parseInt(n,10));
    return `${DAYS_LONG[a]} through ${DAYS_LONG[b]}`;
  }

  // list
  if (raw.includes(',')) {
    const names = unique.map(d => DAYS_LONG[d]);
    const last = names.pop();
    return names.length ? `${names.join(', ')} and ${last}` : last;
  }

  return `on ${unique.map(d => DAYS_SHORT[d]).join(', ')}`;
}

function describeDay(dField) {
  const raw = dField.raw;
  if (raw === '*') return null;
  const vals = [...dField.values].sort((a,b)=>a-b);
  if (vals.length === 1) return `on the ${ordinal(vals[0])}`;
  return `on the ${vals.map(ordinal).join(', ')}`;
}

function describeMonth(mField) {
  const raw = mField.raw;
  if (raw === '*') return null;
  const vals = [...mField.values].sort((a,b)=>a-b);
  if (vals.length === 1) return `in ${MONTHS_LONG[vals[0]-1]}`;
  if (raw.includes('-')) {
    const [a,b] = raw.split('-').map(Number);
    return `${MONTHS_SHORT[a-1]} through ${MONTHS_SHORT[b-1]}`;
  }
  return `in ${vals.map(v => MONTHS_SHORT[v-1]).join(', ')}`;
}

function describe(expr) {
  if (expr === '@reboot') return 'At system reboot';

  const parsed = parseCron(expr);
  if (parsed.isReboot) return 'At system reboot';

  const timePart    = formatTime(parsed.minute, parsed.hour);
  const weekdayPart = describeWeekday(parsed.weekday);
  const dayPart     = describeDay(parsed.day);
  const monthPart   = describeMonth(parsed.month);

  const parts = [];

  // Capitalize first letter of time part
  parts.push(timePart.charAt(0).toUpperCase() + timePart.slice(1));

  if (weekdayPart && !dayPart) parts.push(weekdayPart);
  if (dayPart && !weekdayPart) parts.push(dayPart);
  if (dayPart && weekdayPart)  parts.push(`${dayPart} or ${weekdayPart}`);
  if (monthPart) parts.push(monthPart);

  return parts.join(', ');
}

// ── Next execution calculator ─────────────────────────────────────────────────
function matchesField(value, field, isWeekday = false) {
  if (isWeekday) {
    // normalize: treat 7 as 0
    const v = value === 7 ? 0 : value;
    return field.values.has(v) || field.values.has(value);
  }
  return field.values.has(value);
}

function getNextExecutions(expr, count = 1, fromDate = new Date(), tz = null) {
  if (expr === '@reboot') return ['@reboot — triggers at system startup'];

  const parsed = parseCron(expr);
  const results = [];
  const now = new Date(fromDate);
  now.setSeconds(0, 0);

  // advance by 1 minute to not include current minute
  now.setMinutes(now.getMinutes() + 1);

  let iterations = 0;
  const MAX_ITER = 500000;

  while (results.length < count && iterations < MAX_ITER) {
    iterations++;

    const mo = now.getMonth() + 1; // 1-12
    const d  = now.getDate();       // 1-31
    const wd = now.getDay();        // 0=Sun
    const h  = now.getHours();
    const m  = now.getMinutes();

    if (!matchesField(mo, parsed.month)) {
      // advance to next matching month
      const currentYear = now.getFullYear();
      let found = false;
      for (let nm = mo + 1; nm <= 12; nm++) {
        if (matchesField(nm, parsed.month)) {
          now.setMonth(nm - 1, 1);
          now.setHours(0, 0, 0, 0);
          found = true; break;
        }
      }
      if (!found) {
        now.setFullYear(currentYear + 1, 0, 1);
        now.setHours(0, 0, 0, 0);
      }
      continue;
    }

    // weekday check (only if weekday field is not *)
    const weekdayIsWild = parsed.weekday.raw === '*';
    const dayIsWild     = parsed.day.raw === '*';

    let dayMatch;
    if (weekdayIsWild && dayIsWild) {
      dayMatch = true;
    } else if (weekdayIsWild) {
      dayMatch = matchesField(d, parsed.day);
    } else if (dayIsWild) {
      dayMatch = matchesField(wd, parsed.weekday, true);
    } else {
      // both specified — OR logic per cron spec
      dayMatch = matchesField(d, parsed.day) || matchesField(wd, parsed.weekday, true);
    }

    if (!dayMatch) {
      now.setDate(now.getDate() + 1);
      now.setHours(0, 0, 0, 0);
      continue;
    }

    if (!matchesField(h, parsed.hour)) {
      // find next valid hour
      let found = false;
      for (let nh = h + 1; nh <= 23; nh++) {
        if (matchesField(nh, parsed.hour)) {
          now.setHours(nh, 0, 0, 0);
          found = true; break;
        }
      }
      if (!found) {
        now.setDate(now.getDate() + 1);
        now.setHours(0, 0, 0, 0);
      }
      continue;
    }

    if (!matchesField(m, parsed.minute)) {
      // find next valid minute
      let found = false;
      for (let nm = m + 1; nm <= 59; nm++) {
        if (matchesField(nm, parsed.minute)) {
          now.setMinutes(nm, 0, 0);
          found = true; break;
        }
      }
      if (!found) {
        now.setHours(now.getHours() + 1, 0, 0, 0);
      }
      continue;
    }

    // found a match
    results.push(new Date(now));
    now.setMinutes(now.getMinutes() + 1);
  }

  return results.map(d => formatExecution(d, fromDate, tz));
}

function formatExecution(target, from, tz) {
  const diffMs  = target - from;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  let relative;
  if (diffMin < 1)       relative = 'in less than a minute';
  else if (diffMin < 60) relative = `in ${diffMin} minute${diffMin===1?'':'s'}`;
  else if (diffHr < 24)  relative = `in ${diffHr} hour${diffHr===1?'':'s'}` + (diffMin%60 ? ` ${diffMin%60}m` : '');
  else                   relative = `in ${diffDay} day${diffDay===1?'':'s'}`;

  let formatted;
  if (tz) {
    try {
      formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).format(target);
    } catch {
      formatted = target.toLocaleString();
    }
  } else {
    const pad = n => String(n).padStart(2,'0');
    formatted = `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())} ` +
                `${pad(target.getHours())}:${pad(target.getMinutes())}:${pad(target.getSeconds())}`;
  }

  return { relative, formatted, ts: target.toISOString() };
}

// ── Interactive builder ───────────────────────────────────────────────────────
async function interactiveBuilder() {
  const rl = (await import('readline')).default.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  const ask = (q) => new Promise(res => rl.question(q, res));

  console.log(c(C.bold, '\nCron Expression Builder'));
  console.log(c(C.dim,  'Answer each question to build your expression.\n'));

  const questions = [
    { field: 'minute',  q: 'Minute (0-59, */n, or * for every): ',  def: '*' },
    { field: 'hour',    q: 'Hour (0-23, */n, or * for every): ',     def: '*' },
    { field: 'day',     q: 'Day of month (1-31, or * for every): ',  def: '*' },
    { field: 'month',   q: 'Month (1-12, or * for every): ',         def: '*' },
    { field: 'weekday', q: 'Weekday (0=Sun…6=Sat, or * for every): ', def: '*' },
  ];

  const parts = [];
  for (const { field, q, def } of questions) {
    let answer = '';
    while (true) {
      answer = (await ask(q)).trim() || def;
      const lim = FIELD_LIMITS.find(f => f.name === field);
      try {
        parseField(answer, lim.min, lim.max);
        parts.push(answer);
        break;
      } catch (e) {
        console.log(c(C.red, `  Invalid: ${e.message}. Try again.`));
      }
    }
  }

  rl.close();

  const expr = parts.join(' ');
  console.log('');
  console.log(c(C.cyan, `Expression: ${expr}`));
  console.log(c(C.green, `Description: ${describe(expr)}`));
  console.log('');
  console.log('Next 3 executions:');
  const nexts = getNextExecutions(expr, 3);
  nexts.forEach((n, i) => {
    console.log(`  ${i+1}. ${c(C.yellow, n.relative)} (${n.formatted})`);
  });
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
${c(C.bold, 'cron-parser')} — Parse, describe, and preview cron expressions

${c(C.bold, 'USAGE')}
  cron-parser "<expr>"                    Describe expression in plain English
  cron-parser "<expr>" --next [n]         Show next N execution times (default: 5)
  cron-parser "<expr>" --from "YYYY-MM-DD" Next runs from a specific date
  cron-parser "<expr>" --tz "Asia/Dubai"  Use specific timezone
  cron-parser "<expr>" --json             Output as JSON
  cron-parser --validate "<expr>"         Validate (exit 0=valid, 1=invalid)
  cron-parser --list                      Show common presets
  cron-parser --interactive               Interactive expression builder
  cron-parser --help                      Show this help

${c(C.bold, 'CRON SYNTAX')}
  *        Every
  */n      Every n units
  n        Specific value
  n-m      Range from n to m
  n,m,o    List of values
  n-m/s    Range with step s

${c(C.bold, 'SPECIAL ALIASES')}
  @yearly / @annually   0 0 1 1 *   Once a year, January 1st
  @monthly              0 0 1 * *   Once a month, first day
  @weekly               0 0 * * 0   Once a week, Sunday midnight
  @daily / @midnight    0 0 * * *   Once a day, midnight
  @hourly               0 * * * *   Once an hour
  @reboot                           At system startup

${c(C.bold, 'EXAMPLES')}
  cron-parser "0 9 * * 1-5"
  cron-parser "*/15 * * * *" --next 5
  cron-parser "@daily" --next 3
  cron-parser "0 9 * * 1-5" --from "2026-06-01"
  cron-parser "0 9 * * *" --tz "America/New_York" --next 3
  cron-parser --validate "0 9 * * 1-5"
  cron-parser "0 9 * * 1-5" --json
`);
}

function printList(asJson) {
  if (asJson) {
    console.log(JSON.stringify(PRESETS.map(p => ({
      expression: p.expr,
      description: p.desc,
    })), null, 2));
    return;
  }

  console.log(c(C.bold, '\nCommon Cron Presets\n'));
  const exprWidth = Math.max(...PRESETS.map(p => p.expr.length));
  for (const { expr, desc } of PRESETS) {
    console.log(`  ${c(C.cyan, expr.padEnd(exprWidth))}  ${desc}`);
  }
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const asJson      = args.includes('--json');
  const isValidate  = args.includes('--validate');
  const isList      = args.includes('--list');
  const isInteract  = args.includes('--interactive');

  // --list
  if (isList) { printList(asJson); process.exit(0); }

  // --interactive
  if (isInteract) { await interactiveBuilder(); process.exit(0); }

  // --validate
  if (isValidate) {
    const idx = args.indexOf('--validate');
    const expr = args[idx + 1];
    if (!expr) { console.error(c(C.red, 'Error: --validate requires an expression')); process.exit(1); }
    const result = validateCron(expr);
    if (asJson) {
      console.log(JSON.stringify({ expression: expr, valid: result.valid, error: result.error || null }));
    } else if (result.valid) {
      console.log(c(C.green, `Valid: ${expr}`));
    } else {
      console.log(c(C.red, `Invalid: ${expr}`));
      console.log(c(C.red, `  ${result.error}`));
    }
    process.exit(result.valid ? 0 : 1);
  }

  // main: describe + next
  // Collect values consumed by named flags so we don't treat them as the expression
  const flagValueIndices = new Set();
  for (const flag of ['--next', '--from', '--tz']) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) flagValueIndices.add(idx + 1);
  }
  const expr = args.find((a, i) => !a.startsWith('--') && !flagValueIndices.has(i));
  if (!expr) { printHelp(); process.exit(1); }

  // resolve @alias display label
  let displayExpr = expr;
  if (expr.startsWith('@') && ALIASES[expr]) displayExpr = `${expr}  (${ALIASES[expr]})`;

  // parse
  let parsed;
  try {
    parsed = parseCron(expr);
  } catch (e) {
    if (asJson) {
      console.log(JSON.stringify({ valid: false, error: e.message }));
    } else {
      console.log(c(C.red, `Error: ${e.message}`));
    }
    process.exit(1);
  }

  // --next
  const nextIdx = args.indexOf('--next');
  const showNext = nextIdx !== -1;
  const nextCount = showNext ? (parseInt(args[nextIdx + 1], 10) || 5) : 5;

  // --from
  const fromIdx = args.indexOf('--from');
  let fromDate = new Date();
  if (fromIdx !== -1 && args[fromIdx + 1]) {
    const d = new Date(args[fromIdx + 1]);
    if (isNaN(d)) { console.error(c(C.red, `Invalid --from date: ${args[fromIdx+1]}`)); process.exit(1); }
    fromDate = d;
  }

  // --tz
  const tzIdx = args.indexOf('--tz');
  const tz = tzIdx !== -1 ? args[tzIdx + 1] : null;

  const humanDesc  = describe(expr);
  const executions = getNextExecutions(expr, nextCount, fromDate, tz);

  if (asJson) {
    console.log(JSON.stringify({
      expression:  expr,
      description: humanDesc,
      valid:       true,
      timezone:    tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
      from:        fromDate.toISOString(),
      next:        executions,
    }, null, 2));
    return;
  }

  // formatted output
  console.log('');
  console.log(`  ${c(C.bold, 'Expression:')}  ${c(C.cyan, displayExpr)}`);
  console.log(`  ${c(C.bold, 'Meaning:   ')}  ${c(C.green, humanDesc)}`);
  if (tz) console.log(`  ${c(C.bold, 'Timezone:  ')}  ${tz}`);
  console.log('');

  const label = showNext ? `Next ${nextCount} Execution${nextCount===1?'':'s'}` : `Next ${nextCount} Executions`;
  console.log(`  ${c(C.bold, label)}`);
  console.log(`  ${c(C.dim, '─'.repeat(50))}`);
  executions.forEach((e, i) => {
    if (typeof e === 'string') {
      console.log(`  ${i+1}. ${e}`);
    } else {
      console.log(`  ${String(i+1).padStart(2)}. ${c(C.yellow, e.relative.padEnd(28))} ${c(C.dim, e.formatted)}`);
    }
  });
  console.log('');
}

main().catch(e => {
  console.error(c(C.red, `Fatal: ${e.message}`));
  process.exit(1);
});
