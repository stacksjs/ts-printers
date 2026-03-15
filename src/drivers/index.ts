/**
 * Printer Driver Registry
 *
 * Manages driver matching and instantiation. When a printer is discovered
 * or specified manually, the registry finds the best driver for it.
 *
 * Drivers are matched in order of specificity:
 * 1. Vendor-specific drivers (HP, Canon, etc.) — matched by model/name
 * 2. Generic IPP driver — fallback for any IPP printer
 */

import type { DiscoveredPrinter } from '../types'
import type { DriverFactory, DriverMatcher } from './base'
import { PrinterDriver } from './base'
import { hpFactory, hpMatcher } from './hp'
import { genericIppFactory, genericIppMatcher } from './generic'

interface RegisteredDriver {
  name: string
  matcher: DriverMatcher
  factory: DriverFactory
}

const drivers: RegisteredDriver[] = [
  // Vendor drivers (checked first, in order)
  { name: 'HP', matcher: hpMatcher, factory: hpFactory },
  // Generic fallback (always last)
  { name: 'Generic IPP', matcher: genericIppMatcher, factory: genericIppFactory },
]

/**
 * Register a custom driver. Custom drivers are checked before built-in ones.
 */
export function registerDriver(name: string, matcher: DriverMatcher, factory: DriverFactory): void {
  // Insert before the generic fallback
  drivers.splice(drivers.length - 1, 0, { name, matcher, factory })
}

/**
 * Create the appropriate driver for a discovered printer.
 */
export function createDriver(printer: DiscoveredPrinter): PrinterDriver {
  for (const reg of drivers) {
    if (reg.matcher(printer)) {
      return reg.factory(printer.uri, printer.host, printer.name)
    }
  }

  // Should never happen since generic always matches
  return genericIppFactory(printer.uri, printer.host, printer.name)
}

/**
 * Create a driver from a URI and optional host/name.
 * Tries to detect the printer model via IPP to pick the right driver.
 */
export function createDriverFromUri(uri: string, host?: string, name?: string): PrinterDriver {
  const resolvedHost = host ?? extractHostFromUri(uri)
  const resolvedName = name ?? uri

  // Try to match by URI pattern
  for (const reg of drivers) {
    if (reg.matcher({ uri, model: resolvedName })) {
      return reg.factory(uri, resolvedHost, resolvedName)
    }
  }

  return genericIppFactory(uri, resolvedHost, resolvedName)
}

/**
 * Create a driver from just a host (for firmware/maintenance which don't need an IPP URI).
 * Probes the printer to detect the vendor.
 */
export async function createDriverFromHost(host: string): Promise<PrinterDriver> {
  const uri = `ipp://${host}:631/ipp/print`

  // Try to detect HP by checking for LEDM endpoints
  try {
    const response = await globalThis.fetch(`http://${host}/DevMgmt/ProductConfigDyn.xml`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) {
      const xml = await response.text()
      if (xml.includes('hp.com') || xml.includes('HP') || xml.includes('Tango')) {
        return hpFactory(uri, host, 'HP Printer')
      }
    }
  }
  catch {
    // Not HP or not reachable via LEDM
  }

  return genericIppFactory(uri, host, host)
}

function extractHostFromUri(uri: string): string {
  try {
    const cleaned = uri.replace('ipp://', 'http://').replace('ipps://', 'https://')
    return new URL(cleaned).hostname
  }
  catch {
    return uri
  }
}

// Re-export base types and drivers
export { PrinterDriver } from './base'
export type { DriverCapabilities, DriverFactory, DriverMatcher, FirmwareInfo, MaintenanceResult, CleaningLevel, ProgressCallback } from './base'
export { GenericIppDriver } from './generic'
export { HpDriver, HpFirmware, HpMaintenance } from './hp'
