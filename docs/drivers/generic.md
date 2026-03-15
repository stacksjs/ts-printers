# Generic IPP Driver

The generic IPP driver handles any printer that supports the Internet Printing Protocol (IPP). This includes most modern network printers from any manufacturer.

## Supported Operations

- **Print** — Send documents (PDF, JPEG, PNG, PostScript, plain text)
- **Job management** — List, cancel, and check status of print jobs
- **Printer status** — State, ink/toner levels, supported formats, capabilities
- **Identify** — Make the printer beep or flash its LED (if supported)
- **Validate** — Check if a job would succeed before printing

## Usage

```ts
import { Printer } from 'ts-printers'

const printer = new Printer('ipp://my-printer.local:631/ipp/print')

// All standard IPP operations work
const status = await printer.status()
const job = await printer.printFile('./document.pdf')
const jobs = await printer.jobs()
await printer.cancelJob(job.id)
```

## Print Options

```ts
await printer.printFile('./document.pdf', {
  copies: 3,
  quality: 'high',           // draft, normal, high
  colorMode: 'monochrome',   // color, monochrome
  sides: 'two-sided-long-edge', // one-sided, two-sided-long-edge, two-sided-short-edge
  media: 'na_letter_8.5x11in', // paper size
  orientation: 'landscape',  // portrait, landscape
  fitToPage: true,
  jobName: 'My Document',
})
```

## Auto-Detection of Document Format

When printing raw data, ts-printers auto-detects the format by checking file headers:

| Format | Magic Bytes | MIME Type |
|--------|-------------|-----------|
| PDF | `%PDF` | `application/pdf` |
| JPEG | `FF D8 FF` | `image/jpeg` |
| PNG | `89 50 4E 47` | `image/png` |
| PostScript | `%!` | `application/postscript` |
| Other | — | `application/octet-stream` |

When printing from a file path, the extension is used instead.

## Limitations

The generic driver does not support vendor-specific features:

- No firmware management
- No printhead cleaning or maintenance
- No power management
- No vendor-specific diagnostics

For these features, use a vendor-specific driver (e.g., the HP driver).
