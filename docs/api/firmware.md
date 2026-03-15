# Firmware Updates

Firmware management is a driver-specific feature. Currently, the HP driver provides full automated firmware updates.

## Via Printer API

```ts
const printer = await Printer.fromHost('192.168.0.147')

// Check firmware info
const info = await printer.getFirmwareInfo()
console.log(info.currentVersion)  // "INFNTYLP2N001.2330A.00"

// Auto-update (download + install)
const result = await printer.updateFirmware((msg) => console.log(msg))

// Upload a local firmware file
const result = await printer.uploadFirmware('./firmware.ful2', (msg) => console.log(msg))
```

## Via HP Driver Directly

```ts
import { HpFirmware } from 'ts-printers'

const fw = new HpFirmware('192.168.0.147')

// Get current firmware info
const info = await fw.getInfo()

// Get update state
const state = await fw.getState()

// Get/set auto-update config
const config = await fw.getConfig()
await fw.setConfig({ automaticCheck: true, automaticUpdate: true })

// Reset error state
await fw.reset()

// Automated update
const result = await fw.autoUpdate((msg) => console.log(msg))
```

## How Auto-Update Works

1. Reads the printer's model and firmware version via LEDM
2. Looks up the latest firmware in the built-in registry
3. Downloads the firmware package from `ftp.hp.com`
4. Finds the 7z archive inside the self-extracting `.exe`
5. Extracts the `.ful2` firmware binary using `7z`
6. Puts the printer into recovery mode via LEDM (`FirmwareMode = recovery`)
7. Waits for port 9100 to become available in recovery mode
8. Sends the firmware via raw TCP to port 9100
9. Polls the printer until the new firmware version is confirmed

## Supported Models

| Model | Product # | Latest Firmware |
|-------|-----------|----------------|
| HP Tango / Tango X | 3DP64A | INFNTYLP2N001.2330A.00 |

## Prerequisites

- **p7zip** must be installed for firmware extraction: `brew install p7zip`
