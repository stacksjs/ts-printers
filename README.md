<p align="center"><img src=".github/art/cover.jpg" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# ts-printers

A TypeScript library and CLI for interacting with printers via IPP (Internet Printing Protocol). Driver-based architecture with built-in HP support for firmware updates, printhead maintenance, and more.

## Features

- **Driver-Based Architecture** — Extensible driver system. HP driver built-in, generic IPP fallback for any printer
- **IPP 2.0 Protocol** — Full binary encoding/decoding, zero external dependencies
- **Network Discovery** — Find printers via mDNS/Bonjour, auto-detect vendor
- **Firmware Updates** — Automated download, extraction, and installation from HP's servers
- **Printer Maintenance** — Printhead cleaning (3 levels), alignment, diagnostic pages
- **CLI & Library** — Use from the command line or import into your TypeScript project
- **Standalone Binary** — Compile to a single executable for any platform

## Install

```bash
bun install ts-printers
```

> **Note:** `p7zip` is required for automated HP firmware updates: `brew install p7zip`

## Get Started

### Library

```ts
import { Printer, discoverPrinters } from 'ts-printers'

// Discover printers on the network
const printers = await discoverPrinters()

// Connect and get status
const printer = new Printer('ipp://HP-Tango.local:631/ipp/print')
const status = await printer.status()
console.log(`${status.model}: ${status.state}`)
console.log(`Ink: ${status.markerNames.map((n, i) => `${n} ${status.markerLevels[i]}%`).join(', ')}`)

// Print a file
await printer.printFile('./document.pdf', { copies: 2, quality: 'high' })

// HP-specific: firmware & maintenance
await printer.updateFirmware(msg => console.log(msg))
await printer.clean('level1')
await printer.align()
```

### CLI

```bash
# Discovery
print discover

# Printing
print status --printer ipp://printer:631/ipp/print
print send document.pdf --copies 2 --quality high
print jobs
print cancel 42

# Firmware (HP)
print firmware --host 192.168.0.147
print firmware:update --host 192.168.0.147

# Maintenance (HP)
print clean --host 192.168.0.147 --level 2
print align --host 192.168.0.147
print maintain --host 192.168.0.147
print diagnostic --host 192.168.0.147 --type quality
```

## Drivers

ts-printers uses a driver-based architecture. The right driver is auto-selected based on the printer model:

| Feature | HP Driver | Generic IPP |
|---------|-----------|-------------|
| Printing & jobs | yes | yes |
| Status & ink levels | yes | yes |
| Firmware updates | yes | — |
| Printhead cleaning | yes | — |
| Alignment | yes | — |
| Diagnostics | yes | — |
| Power cycle | yes | — |

Add custom drivers for other manufacturers:

```ts
import { registerDriver } from 'ts-printers'

registerDriver('Canon', matcher, factory)
```

## Configuration

Create a `print.config.ts` in your project root:

```ts
import type { PrintConfig } from 'ts-printers'

export default {
  defaultPrinter: 'ipp://HP-Tango.local:631/ipp/print',
  verbose: false,
} satisfies PrintConfig
```

## Tested Printers

- **HP Tango X (Exclusive)** — fully tested (firmware, cleaning, diagnostics)
- Any IPP-compatible printer — standard printing operations

## Documentation

Full documentation is available at [ts-printers.stacksjs.com](https://ts-printers.stacksjs.com).

## Testing

```bash
bun test
```

## Changelog

Please see our [releases](https://github.com/stacksjs/ts-printers/releases) page for more information on what has changed recently.

## Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/ts-printers/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Postcardware

"Software that is free, but hopes for a postcard." We love receiving postcards from around the world showing where Stacks is being used! We showcase them on our website too.

Our address: Stacks.js, 12665 Village Ln #2306, Playa Vista, CA 90094, United States 🌎

## Sponsors

We would like to extend our thanks to the following sponsors for funding Stacks development. If you are interested in becoming a sponsor, please reach out to us.

- [JetBrains](https://www.jetbrains.com/)
- [The Solana Foundation](https://solana.com/)

## License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with 💙

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/ts-printers?style=flat-square
[npm-version-href]: https://npmjs.com/package/ts-printers
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/ts-printers/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/ts-printers/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/ts-printers/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/ts-printers -->
