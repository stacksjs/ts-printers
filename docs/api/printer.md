# Printer API

The `Printer` class is the main entry point for interacting with printers. It auto-selects the appropriate driver based on the printer's URI and model.

## Constructor

```ts
import { Printer } from 'ts-printers'

const printer = new Printer(uri: string, name?: string)
```

## Static Methods

### `Printer.fromHost(host)`

Create a printer from a hostname with auto-detection of the vendor driver.

```ts
const printer = await Printer.fromHost('192.168.0.147')
// Probes LEDM to detect HP, falls back to generic IPP
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `uri` | `string` | Printer IPP URI |
| `name` | `string` | Display name |
| `driverName` | `string` | Active driver name ("HP", "Generic IPP") |

## Methods

### `status()`

Get printer status, capabilities, and ink levels.

```ts
const status = await printer.status()
```

Returns `PrinterStatus`:

| Field | Type | Description |
|-------|------|-------------|
| `state` | `'idle' \| 'processing' \| 'stopped' \| 'unknown'` | Current state |
| `stateReasons` | `string[]` | Status reasons (e.g., "media-low-warning") |
| `model` | `string?` | Make and model |
| `colorSupported` | `boolean` | Color printing support |
| `duplexSupported` | `boolean` | Double-sided printing |
| `supportedFormats` | `string[]` | Accepted document formats |
| `markerNames` | `string[]` | Ink/toner cartridge names |
| `markerLevels` | `number[]` | Ink/toner levels (0-100) |

### `print(data, options?)`

Print raw data (Buffer/Uint8Array).

```ts
const job = await printer.print(pdfBuffer, {
  copies: 2,
  quality: 'high',
})
```

### `printFile(filePath, options?)`

Print a file from disk. Auto-detects the document format from the file extension.

```ts
const job = await printer.printFile('./document.pdf')
```

### `jobs(which?)`

List print jobs. `which` can be `'completed'`, `'not-completed'` (default), or `'all'`.

```ts
const activeJobs = await printer.jobs()
const allJobs = await printer.jobs('all')
```

### `cancelJob(jobId)`

Cancel a print job by ID.

```ts
await printer.cancelJob(42)
```

### `identify()`

Make the printer beep or flash to identify itself.

```ts
await printer.identify()
```

### `capabilities()`

Get the driver's capability declarations.

```ts
const caps = printer.capabilities()
if (caps.firmware) { /* firmware features available */ }
if (caps.maintenance) { /* cleaning/alignment available */ }
```

### `getDriver<T>()`

Get the underlying driver instance for direct access to vendor-specific APIs.

```ts
import type { HpDriver } from 'ts-printers'
const hp = printer.getDriver<HpDriver>()
```

## Print Job Options

```ts
interface PrintJobOptions {
  copies?: number
  media?: string           // e.g. 'na_letter_8.5x11in'
  orientation?: 'portrait' | 'landscape'
  quality?: 'draft' | 'normal' | 'high'
  sides?: 'one-sided' | 'two-sided-long-edge' | 'two-sided-short-edge'
  colorMode?: 'color' | 'monochrome'
  documentFormat?: string  // MIME type override
  jobName?: string
  fitToPage?: boolean
}
```
