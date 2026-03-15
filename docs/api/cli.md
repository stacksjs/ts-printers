# CLI Commands

The `print` CLI provides all library features from the command line.

## Discovery

### `print discover`

Find printers on the local network.

```sh
print discover
print discover --timeout 10000
print discover --protocol ipps
```

| Option | Default | Description |
|--------|---------|-------------|
| `--timeout <ms>` | 5000 | How long to search |
| `--protocol <p>` | both | `ipp`, `ipps`, or `both` |

## Printing

### `print send <file>`

Print a file.

```sh
print send document.pdf
print send photo.jpg --copies 2 --quality high --fit
print send report.pdf --printer ipp://printer:631/ipp/print --color monochrome
```

| Option | Default | Description |
|--------|---------|-------------|
| `--printer <uri>` | auto-discover | Printer IPP URI |
| `--copies <n>` | 1 | Number of copies |
| `--quality <q>` | normal | `draft`, `normal`, `high` |
| `--color <c>` | — | `color`, `monochrome` |
| `--sides <s>` | — | `one-sided`, `two-sided-long-edge`, `two-sided-short-edge` |
| `--media <m>` | — | Paper size (e.g., `na_letter_8.5x11in`) |
| `--orientation <o>` | — | `portrait`, `landscape` |
| `--name <n>` | — | Job name |
| `--fit` | false | Fit to page |

## Status & Jobs

### `print status`

Get printer status and ink levels.

```sh
print status
print status --printer ipp://printer:631/ipp/print
```

### `print jobs`

List print jobs.

```sh
print jobs
print jobs --which all
print jobs --which completed
```

### `print cancel <job-id>`

Cancel a print job.

```sh
print cancel 42
```

### `print identify`

Make the printer beep or flash.

```sh
print identify --printer ipp://printer:631/ipp/print
```

## Firmware

### `print firmware`

Show firmware information.

```sh
print firmware --host 192.168.0.147
```

### `print firmware:update`

Download and install the latest firmware automatically.

```sh
print firmware:update --host 192.168.0.147
```

### `print firmware:upload <file>`

Upload a firmware file directly.

```sh
print firmware:upload firmware.ful2 --host 192.168.0.147
```

## Maintenance

### `print clean`

Clean the printhead.

```sh
print clean --host 192.168.0.147
print clean --host 192.168.0.147 --level 2
print clean --host 192.168.0.147 --level 3
```

### `print align`

Align the printhead.

```sh
print align --host 192.168.0.147
```

### `print maintain`

Run the full maintenance routine (clean + align).

```sh
print maintain --host 192.168.0.147
```

### `print diagnostic`

Print a diagnostic page.

```sh
print diagnostic --host 192.168.0.147 --type quality
print diagnostic --host 192.168.0.147 --type config
print diagnostic --host 192.168.0.147 --type network
print diagnostic --host 192.168.0.147 --type smear
```

## Auto-Discovery

When `--printer` or `--host` is omitted, the CLI automatically discovers printers on the network and uses the first one found. If multiple printers are found, it lists them and uses the first.

To avoid discovery, set `defaultPrinter` in `print.config.ts`.
