# What is ts-printers?

`ts-printers` is a TypeScript library and CLI for interacting with network printers. It provides a driver-based architecture where vendor-specific features (firmware updates, printhead maintenance) are handled by dedicated drivers, while standard printing operations use the IPP (Internet Printing Protocol).

## Key Features

- **Driver-based architecture** — Extensible system with HP driver built-in, generic IPP fallback for any printer
- **IPP 2.0 protocol** — Full binary encoding/decoding, implemented from scratch with zero external dependencies
- **Printer discovery** — Find printers on your network via mDNS/Bonjour
- **Firmware management** — Automated firmware download, extraction, and installation (HP printers)
- **Printer maintenance** — Printhead cleaning, alignment, ink smear cleaning, diagnostic pages
- **CLI & library** — Use from the command line or import into your TypeScript project

## Supported Printers

### HP (full support)
- HP Tango / Tango X (Exclusive) — fully tested
- Other HP inkjet printers with LEDM support — should work

### Generic IPP (standard features)
- Any IPP-compatible printer (most modern network printers)
- Printing, job management, status, ink levels

## How It Works

```
ts-printers
├── Discovery (mDNS/Bonjour)
│   └── Finds printers on your network
├── Driver Registry
│   ├── HP Driver (firmware, maintenance, printing)
│   ├── Generic IPP Driver (printing only)
│   └── Custom drivers (extensible)
└── IPP Protocol
    └── Binary encoding/decoding over HTTP
```

When you connect to a printer, `ts-printers` auto-detects the vendor and selects the appropriate driver. HP printers get full firmware and maintenance support. Other printers use the generic IPP driver for standard operations.

## Quick Example

```ts
import { Printer } from 'ts-printers'

// Auto-detects HP driver
const printer = new Printer('ipp://HP-Tango.local:631/ipp/print')

// Standard IPP operations (all printers)
const status = await printer.status()
console.log(status.state, status.markerLevels)

await printer.printFile('./document.pdf')

// HP-specific features
await printer.clean('level1')
await printer.updateFirmware(msg => console.log(msg))
```
