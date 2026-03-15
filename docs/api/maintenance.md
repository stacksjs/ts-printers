# Maintenance

Printer maintenance operations are driver-specific. The HP driver provides printhead cleaning, alignment, and diagnostic pages via the LEDM protocol.

## Via Printer API

```ts
const printer = await Printer.fromHost('192.168.0.147')

// Printhead cleaning
await printer.clean('level1')  // basic cleaning
await printer.clean('level2')  // deep cleaning
await printer.clean('level3')  // deepest (uses most ink)

// Printhead alignment
await printer.align()

// Diagnostic pages
await printer.diagnostic('quality')  // print quality test
await printer.diagnostic('config')   // configuration page
await printer.diagnostic('network')  // network summary
await printer.diagnostic('smear')    // ink smear cleaning

// Full maintenance routine
const results = await printer.fullMaintenance((msg) => console.log(msg))
```

## Via HP Maintenance Directly

```ts
import { HpMaintenance } from 'ts-printers'

const maint = new HpMaintenance('192.168.0.147')

await maint.clean('level1')
await maint.cleaningVerification()
await maint.cleanSmear()
await maint.printQualityDiagnostics()
await maint.diagnostics()
await maint.configurationPage()
await maint.networkSummary()
await maint.align()
await maint.calibrationNeeded()  // returns boolean
```

## Cleaning Levels

| Level | Use Case | Ink Usage |
|-------|----------|-----------|
| `level1` | First attempt for poor print quality | Low |
| `level2` | If level 1 didn't help | Medium |
| `level3` | Last resort before replacing cartridge | High |

For a printer that hasn't been used in a long time, run level 1 first, then check with a quality diagnostic page. If still poor, run level 2. Level 3 is rarely needed.

## Full Maintenance Routine

The `fullMaintenance()` method runs a complete cycle:

1. Level 1 printhead cleaning
2. Cleaning verification page
3. Level 2 deep cleaning
4. Printhead alignment check

Each step waits for the printer to become idle before proceeding.

## Return Type

All maintenance operations return:

```ts
interface MaintenanceResult {
  success: boolean
  message: string
}
```

## Retry Logic

Maintenance operations automatically retry up to 3 times when the printer returns HTTP 503 (busy/sleeping). This handles cases where the printer is waking from power save mode.
