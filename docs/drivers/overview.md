# Driver System

ts-printers uses a driver-based architecture. Each printer vendor/model can have a dedicated driver that provides vendor-specific features on top of standard IPP operations.

## How It Works

```
┌─────────────────────────────┐
│         Printer API         │  ← Your code uses this
├─────────────────────────────┤
│      Driver Registry        │  ← Auto-selects driver
├──────────┬──────────────────┤
│ HP Driver│ Generic IPP      │  ← Vendor implementations
│ firmware │ printing         │
│ cleaning │ jobs             │
│ alignment│ status           │
├──────────┴──────────────────┤
│      IPP Protocol           │  ← Binary encoding/HTTP
└─────────────────────────────┘
```

When you create a `Printer` instance, the driver registry examines the URI and printer name to select the best driver:

1. **HP Driver** — matched when the URI, name, or model contains "HP" or "Hewlett"
2. **Generic IPP** — fallback for all other IPP-compatible printers

## Driver Capabilities

Each driver declares its capabilities:

```ts
interface DriverCapabilities {
  printing: boolean      // IPP printing support
  scanning: boolean      // scanning support
  firmware: boolean      // firmware management
  maintenance: boolean   // printhead cleaning, alignment
  identify: boolean      // beep/flash identification
}
```

| Feature | HP Driver | Generic IPP |
|---------|-----------|-------------|
| Printing | yes | yes |
| Job management | yes | yes |
| Status & ink levels | yes | yes |
| Identify | yes | yes |
| Firmware updates | yes | no |
| Printhead cleaning | yes | no |
| Alignment | yes | no |
| Diagnostics | yes | no |
| Power cycle | yes | no |

## Auto-Detection

For host-based commands (firmware, maintenance), ts-printers probes the printer to detect the vendor:

```ts
import { createDriverFromHost } from 'ts-printers'

// Probes LEDM endpoints to detect HP printers
const driver = await createDriverFromHost('192.168.0.147')
console.log(driver.driverName)  // "HP" or "Generic IPP"
```

## Checking Capabilities

```ts
const printer = new Printer('ipp://my-printer:631/ipp/print')
const caps = printer.capabilities()

if (caps.firmware) {
  await printer.updateFirmware()
}

if (caps.maintenance) {
  await printer.clean('level1')
}
```
