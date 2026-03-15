# Configuration

ts-printers can be configured using a `print.config.ts` file in your project root. It will be automatically loaded by both the CLI and the library.

## Configuration File

```ts
// print.config.ts
import type { PrintConfig } from 'ts-printers'

const config: PrintConfig = {
  // Default printer URI or name (used when --printer is omitted)
  defaultPrinter: 'ipp://HP-Tango.local:631/ipp/print',

  // Named printers for quick access
  printers: {
    tango: {
      uri: 'ipp://HP-Tango.local:631/ipp/print',
      name: 'HP Tango Exclusive',
      model: 'HP Tango X',
    },
    office: {
      uri: 'ipp://office-printer.local:631/ipp/print',
      name: 'Office Printer',
    },
  },

  // Request timeout in milliseconds
  timeout: 10000,

  // Enable verbose logging
  verbose: false,
}

export default config
```

## PrintConfig Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultPrinter` | `string` | — | Default printer URI or key from `printers` map |
| `printers` | `Record<string, PrinterEntry>` | — | Named printer configurations |
| `timeout` | `number` | `10000` | Request timeout in ms |
| `verbose` | `boolean` | `false` | Enable verbose logging |

## PrinterEntry

| Option | Type | Description |
|--------|------|-------------|
| `uri` | `string` | IPP URI (e.g. `ipp://host:631/ipp/print`) |
| `name` | `string` | Display name |
| `model` | `string` | Printer model (helps with driver selection) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEBUG` | Enable debug output for discovery |
| `VERBOSE` | Enable verbose logging |

## Auto-Discovery

When no printer is specified (via config or CLI flag), ts-printers will automatically discover printers on the local network using mDNS/Bonjour and use the first one found.
