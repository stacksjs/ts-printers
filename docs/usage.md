# Usage

There are two ways to use ts-printers: as a **library** or as a **CLI**.

## Library

### Discover Printers

```ts
import { discoverPrinters } from 'ts-printers'

const printers = await discoverPrinters({ timeout: 5000 })

for (const p of printers) {
  console.log(`${p.name} at ${p.uri}`)
  console.log(`  Model: ${p.model}`)
  console.log(`  Protocol: ${p.protocol}`)
}
```

### Print a File

```ts
import { Printer } from 'ts-printers'

const printer = new Printer('ipp://HP-Tango.local:631/ipp/print')

// Print a PDF
const job = await printer.printFile('./document.pdf', {
  copies: 2,
  quality: 'high',
  colorMode: 'color',
})
console.log(`Job #${job.id}: ${job.state}`)

// Print raw data
const pdfBuffer = await Bun.file('./photo.jpg').arrayBuffer()
await printer.print(Buffer.from(pdfBuffer), {
  documentFormat: 'image/jpeg',
  fitToPage: true,
})
```

### Get Printer Status

```ts
const status = await printer.status()

console.log(`State: ${status.state}`)  // idle, processing, stopped
console.log(`Model: ${status.model}`)
console.log(`Color: ${status.colorSupported}`)
console.log(`Duplex: ${status.duplexSupported}`)
console.log(`Formats: ${status.supportedFormats}`)

// Ink levels
for (let i = 0; i < status.markerNames.length; i++) {
  console.log(`${status.markerNames[i]}: ${status.markerLevels[i]}%`)
}
```

### Manage Jobs

```ts
// List active jobs
const jobs = await printer.jobs('not-completed')

// List all jobs
const allJobs = await printer.jobs('all')

// Cancel a job
await printer.cancelJob(42)

// Get job details
const job = await printer.jobStatus(42)
```

### HP-Specific: Firmware Updates

```ts
import { Printer } from 'ts-printers'
import type { HpDriver } from 'ts-printers'

const printer = await Printer.fromHost('192.168.0.147')
const hp = printer.getDriver<HpDriver>()

// Check firmware
const info = await hp.getFirmwareInfo()
console.log(`Current: ${info.currentVersion}`)

// Auto-update firmware
const result = await hp.updateFirmware((msg) => {
  console.log(msg)
})
console.log(result.message)
```

### HP-Specific: Maintenance

```ts
// Clean printhead (3 levels)
await printer.clean('level1')  // basic
await printer.clean('level2')  // deep
await printer.clean('level3')  // deepest

// Align printhead
await printer.align()

// Print diagnostic page
await printer.diagnostic('quality')
await printer.diagnostic('config')
await printer.diagnostic('network')

// Full maintenance routine
const results = await printer.fullMaintenance((msg) => {
  console.log(msg)
})
```

## CLI

```sh
# Discovery
print discover
print discover --timeout 10000

# Printer status
print status --printer ipp://printer.local:631/ipp/print

# Print a file
print send document.pdf --printer ipp://printer.local:631/ipp/print
print send photo.jpg --copies 2 --quality high --fit

# Job management
print jobs
print cancel 42

# Firmware (HP)
print firmware --host 192.168.0.147
print firmware:update --host 192.168.0.147
print firmware:upload firmware.ful2 --host 192.168.0.147

# Maintenance (HP)
print clean --host 192.168.0.147 --level 1
print clean --host 192.168.0.147 --level 2
print align --host 192.168.0.147
print maintain --host 192.168.0.147
print diagnostic --host 192.168.0.147 --type quality

# Identify (beep/flash)
print identify --printer ipp://printer.local:631/ipp/print
```
