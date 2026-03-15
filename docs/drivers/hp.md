# HP Driver

The HP driver extends the generic IPP driver with HP-specific features using the LEDM (Lightweight Embedded Device Management) protocol.

## Tested Models

- **HP Tango X (Exclusive)** — fully tested (firmware, cleaning, diagnostics)
- Other HP inkjet printers with LEDM — should work

## Features

### Firmware Management

The HP driver can automatically download and install firmware updates:

1. Reads the printer's current firmware version via LEDM
2. Checks the firmware registry for a newer version
3. Downloads the firmware package from HP's FTP server
4. Extracts the `.ful2` firmware binary from the 7z archive
5. Puts the printer into recovery mode via LEDM
6. Sends the firmware via TCP port 9100
7. Waits for the printer to install and reboot
8. Verifies the new firmware version

```ts
import { Printer } from 'ts-printers'

const printer = await Printer.fromHost('192.168.0.147')

// Check firmware info
const info = await printer.getFirmwareInfo()
console.log(`Current: ${info.currentVersion}`)

// Auto-update
const result = await printer.updateFirmware((msg) => {
  console.log(msg)
})
```

### Printhead Maintenance

After extended periods of non-use, inkjet nozzles dry out. The HP driver supports three cleaning levels:

| Level | Description | Ink Usage |
|-------|-------------|-----------|
| `level1` | Basic cleaning | Low |
| `level2` | Deep cleaning | Medium |
| `level3` | Deepest cleaning | High |

```ts
await printer.clean('level1')  // start here
await printer.clean('level2')  // if still poor
await printer.clean('level3')  // last resort
```

### Alignment

Fixes misaligned colors or blurry text. The driver checks calibration state first and skips if already valid:

```ts
const result = await printer.align()
// "Printhead alignment is already calibrated. No action needed."
```

### Diagnostic Pages

```ts
await printer.diagnostic('quality')  // print quality test page
await printer.diagnostic('config')   // configuration page
await printer.diagnostic('network')  // network summary
await printer.diagnostic('smear')    // ink smear cleaning
```

### Full Maintenance Routine

Runs a complete maintenance cycle with proper waits between operations:

```ts
const results = await printer.fullMaintenance((msg) => {
  console.log(msg)
})
// Step 1: Level 1 cleaning
// Step 2: Verification page
// Step 3: Level 2 deep cleaning
// Step 4: Alignment check
```

### Power Management

```ts
import type { HpDriver } from 'ts-printers'

const hp = printer.getDriver<HpDriver>()
await hp.powerCycle()  // restart the printer
```

## LEDM Protocol

The HP driver communicates with the printer's Embedded Web Server (EWS) via HTTP. Key endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/DevMgmt/ProductConfigDyn.xml` | Firmware version, model, serial |
| `/DevMgmt/ProductStatusDyn.xml` | Printer state, alerts |
| `/DevMgmt/InternalPrintDyn.xml` | Cleaning, diagnostics |
| `/Calibration/State` | Alignment status |
| `/Calibration/Session` | Start alignment |
| `/FirmwareUpdate/FirmwareMode` | Enter recovery mode |
| `/FirmwareUpdate/WebFWUpdate/State` | Firmware update status |
| `/ProductActions/PowerCycle` | Restart printer |
