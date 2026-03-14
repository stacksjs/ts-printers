import type { DiscoveredPrinter } from './types'

/**
 * Discover printers on the local network using dns-sd (Bonjour/mDNS).
 * Works on macOS which has dns-sd built-in.
 *
 * @param timeout - How long to search in milliseconds (default: 5000)
 * @param protocol - Which protocol to search for (default: both ipp and ipps)
 */
export async function discoverPrinters(options?: {
  timeout?: number
  protocol?: 'ipp' | 'ipps' | 'both'
}): Promise<DiscoveredPrinter[]> {
  const timeout = options?.timeout ?? 5000
  const protocol = options?.protocol ?? 'both'

  const printers: DiscoveredPrinter[] = []
  const serviceTypes: Array<{ type: string, protocol: 'ipp' | 'ipps' }> = []

  if (protocol === 'ipp' || protocol === 'both') {
    serviceTypes.push({ type: '_ipp._tcp', protocol: 'ipp' })
  }
  if (protocol === 'ipps' || protocol === 'both') {
    serviceTypes.push({ type: '_ipps._tcp', protocol: 'ipps' })
  }

  for (const svc of serviceTypes) {
    const discovered = await browseServices(svc.type, svc.protocol, timeout)
    printers.push(...discovered)
  }

  // Deduplicate by name (prefer ipps over ipp)
  const seen = new Map<string, DiscoveredPrinter>()
  for (const printer of printers) {
    const existing = seen.get(printer.name)
    if (!existing || (printer.protocol === 'ipps' && existing.protocol === 'ipp')) {
      seen.set(printer.name, printer)
    }
  }

  return Array.from(seen.values())
}

async function browseServices(serviceType: string, protocol: 'ipp' | 'ipps', timeout: number): Promise<DiscoveredPrinter[]> {
  const printers: DiscoveredPrinter[] = []

  try {
    // Step 1: Browse for services
    const browseResult = await runDnsSd(['-B', serviceType, 'local'], timeout)
    const serviceNames = parseBrowseOutput(browseResult)

    // Step 2: Resolve each service to get host/port/txt
    const resolvePromises = serviceNames.map(async (serviceName) => {
      try {
        const resolveResult = await runDnsSd(
          ['-L', serviceName, serviceType, 'local'],
          3000,
        )
        return parseResolveOutput(resolveResult, serviceName, protocol)
      }
      catch {
        return null
      }
    })

    const resolved = await Promise.all(resolvePromises)
    for (const printer of resolved) {
      if (printer) {
        printers.push(printer)
      }
    }
  }
  catch (err) {
    // dns-sd not available or no results
    if (process.env.DEBUG || process.env.VERBOSE) {
      console.error(`Discovery error for ${serviceType}:`, err)
    }
  }

  return printers
}

async function runDnsSd(args: string[], timeout: number): Promise<string> {
  const proc = Bun.spawn(['dns-sd', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill()
    }, timeout)

    const chunks: Uint8Array[] = []

    const reader = proc.stdout.getReader()

    function read(): void {
      reader.read().then(({ done, value }) => {
        if (value) chunks.push(value)
        if (done) {
          clearTimeout(timer)
          const output = Buffer.concat(chunks).toString('utf-8')
          resolve(output)
          return
        }
        read()
      }).catch(() => {
        clearTimeout(timer)
        const output = Buffer.concat(chunks).toString('utf-8')
        resolve(output)
      })
    }

    read()

    proc.exited.then(() => {
      clearTimeout(timer)
      // Give a moment for remaining stdout
      setTimeout(() => {
        const output = Buffer.concat(chunks).toString('utf-8')
        resolve(output)
      }, 100)
    }).catch(reject)
  })
}

function parseBrowseOutput(output: string): string[] {
  const names: string[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    // Format: Timestamp  B/A  Flags  IF  Domain  Service Type  Instance Name
    // e.g.:   14:23:45.123  Add        3  2  local.  _ipp._tcp.  HP Tango
    const match = line.match(/\s+Add\s+\d+\s+\d+\s+\S+\s+\S+\s+(.+)$/)
    if (match) {
      const name = match[1].trim()
      if (name && !names.includes(name)) {
        names.push(name)
      }
    }
  }

  return names
}

function parseResolveOutput(output: string, serviceName: string, protocol: 'ipp' | 'ipps'): DiscoveredPrinter | null {
  const lines = output.split('\n')

  let host = ''
  let port = 631
  const txtRecord: Record<string, string> = {}

  for (const line of lines) {
    // Look for "can be reached at" line
    // e.g.: "HP Tango._ipp._tcp.local. can be reached at HPTango.local.:631 (interface 2)"
    const reachMatch = line.match(/can be reached at\s+(\S+):(\d+)/)
    if (reachMatch) {
      host = reachMatch[1]
      port = Number.parseInt(reachMatch[2], 10)
    }

    // Look for TXT record lines
    // e.g.: "txtvers=1" or "ty=HP Tango" etc.
    const txtMatch = line.match(/^\s+(\w+)=(.*)$/)
    if (txtMatch) {
      txtRecord[txtMatch[1]] = txtMatch[2]
    }
  }

  if (!host)
    return null

  // Build the printer URI
  const scheme = protocol === 'ipps' ? 'ipps' : 'ipp'
  const path = txtRecord.rp || 'ipp/print'
  const uri = `${scheme}://${host}:${port}/${path}`

  return {
    name: serviceName,
    host,
    port,
    uri,
    txtRecord,
    model: txtRecord.ty || txtRecord.product || undefined,
    location: txtRecord.note || undefined,
    protocol,
  }
}

/**
 * Quick check: is dns-sd available on this system?
 */
export async function isDnssdAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['which', 'dns-sd'], { stdout: 'pipe', stderr: 'pipe' })
    const code = await proc.exited
    return code === 0
  }
  catch {
    return false
  }
}
