# Discovery

Find printers on your local network using mDNS/Bonjour.

## `discoverPrinters(options?)`

Scans the local network for IPP printers using `dns-sd` (macOS).

```ts
import { discoverPrinters } from 'ts-printers'

const printers = await discoverPrinters({
  timeout: 5000,        // ms to search (default: 5000)
  protocol: 'both',     // 'ipp', 'ipps', or 'both' (default: 'both')
})
```

### Returns: `DiscoveredPrinter[]`

```ts
interface DiscoveredPrinter {
  name: string                      // "HP Tango [359A83]"
  host: string                      // "HP84A93E359A83.local."
  port: number                      // 631
  uri: string                       // "ipps://HP84A93E359A83.local.:631/ipp/print"
  txtRecord: Record<string, string> // Bonjour TXT record
  model?: string                    // "HP Tango"
  location?: string                 // from TXT 'note' field
  protocol: 'ipp' | 'ipps'
}
```

### Deduplication

When both `_ipp._tcp` and `_ipps._tcp` advertise the same printer, the IPPS (secure) version is preferred.

## `isDnssdAvailable()`

Check if `dns-sd` is available on the system.

```ts
import { isDnssdAvailable } from 'ts-printers'

if (await isDnssdAvailable()) {
  const printers = await discoverPrinters()
}
```

## Platform Support

| Platform | Discovery Method |
|----------|-----------------|
| macOS | `dns-sd` (built-in) |
| Linux | `dns-sd` via avahi (if installed) |
| Windows | Not yet supported |
