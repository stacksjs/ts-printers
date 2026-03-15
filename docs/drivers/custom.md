# Custom Drivers

You can create drivers for any printer manufacturer by extending `GenericIppDriver` or `PrinterDriver` and registering them with the driver registry.

## Creating a Driver

```ts
import { GenericIppDriver, registerDriver } from 'ts-printers'
import type { DriverCapabilities, MaintenanceResult } from 'ts-printers'

class CanonDriver extends GenericIppDriver {
  readonly driverName = 'Canon'

  capabilities(): DriverCapabilities {
    return {
      printing: true,
      scanning: false,
      firmware: false,
      maintenance: true,
      identify: true,
    }
  }

  async clean(level?: 'level1' | 'level2' | 'level3'): Promise<MaintenanceResult> {
    // Canon-specific cleaning logic
    return { success: true, message: 'Cleaning started' }
  }
}
```

## Registering a Driver

```ts
import { registerDriver } from 'ts-printers'

registerDriver(
  'Canon',
  // Matcher: returns true if this driver can handle the printer
  (printer) => {
    const info = `${printer.model ?? ''} ${printer.uri}`.toLowerCase()
    return info.includes('canon')
  },
  // Factory: creates the driver instance
  (uri, host, name) => new CanonDriver(uri, host, name),
)
```

Custom drivers are checked before the generic fallback, so they take priority for matching printers.

## Driver Base Class

If you need full control, extend `PrinterDriver` directly:

```ts
import { PrinterDriver } from 'ts-printers'

class MyDriver extends PrinterDriver {
  readonly driverName = 'My Driver'

  capabilities() { return { printing: true, scanning: false, firmware: false, maintenance: false, identify: false } }

  // Implement all abstract methods:
  async status() { /* ... */ }
  async print(data, options?) { /* ... */ }
  async printFile(path, options?) { /* ... */ }
  async jobs(which?) { /* ... */ }
  async cancelJob(jobId) { /* ... */ }
  async jobStatus(jobId) { /* ... */ }
}
```

## Driver Lifecycle

1. **Registration** — `registerDriver()` adds the driver to the registry
2. **Matching** — When a printer is discovered or specified, the registry tests each driver's matcher in order
3. **Instantiation** — The first matching driver's factory creates the driver instance
4. **Usage** — The `Printer` class delegates all operations to the driver
