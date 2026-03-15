/**
 * HP Printer Driver
 *
 * Extends the generic IPP driver with HP-specific features:
 * - Firmware management via LEDM (read info, auto-update, upload)
 * - Printhead maintenance (cleaning levels 1-3, alignment, diagnostics)
 * - Power management (power cycle, sleep)
 * - HP LEDM XML API for device management
 *
 * Tested with: HP Tango X (Exclusive)
 * Should work with most HP inkjet printers that use LEDM.
 */

import type { DiscoveredPrinter } from '../../types'
import type { CleaningLevel, DriverCapabilities, DriverFactory, DriverMatcher, FirmwareInfo, MaintenanceResult, ProgressCallback } from '../base'
import { GenericIppDriver } from '../generic'
import { HpFirmware } from './firmware'
import { HpMaintenance } from './maintenance'

export class HpDriver extends GenericIppDriver {
  readonly driverName = 'HP'
  private baseUrl: string
  private firmware: HpFirmware
  private maintenance: HpMaintenance

  constructor(uri: string, host: string, name: string) {
    super(uri, host, name)
    this.baseUrl = `http://${host}`
    this.firmware = new HpFirmware(host)
    this.maintenance = new HpMaintenance(host)
  }

  capabilities(): DriverCapabilities {
    return {
      printing: true,
      scanning: false,
      firmware: true,
      maintenance: true,
      identify: true,
    }
  }

  // --- Firmware ---

  async getFirmwareInfo(): Promise<FirmwareInfo> {
    return this.firmware.getInfo()
  }

  async updateFirmware(onProgress?: ProgressCallback): Promise<MaintenanceResult> {
    const result = await this.firmware.autoUpdate(onProgress)
    return { success: result.success, message: result.message }
  }

  async uploadFirmware(filePath: string, onProgress?: ProgressCallback): Promise<MaintenanceResult> {
    const result = await this.firmware.uploadFirmwareFile(filePath, onProgress)
    return { success: result.success, message: result.message }
  }

  // --- Maintenance ---

  async clean(level: CleaningLevel = 'level1'): Promise<MaintenanceResult> {
    return this.maintenance.clean(level)
  }

  async align(): Promise<MaintenanceResult> {
    return this.maintenance.align()
  }

  async fullMaintenance(onProgress?: ProgressCallback): Promise<MaintenanceResult[]> {
    return this.maintenance.fullMaintenance(onProgress)
  }

  async diagnostic(type?: string): Promise<MaintenanceResult> {
    switch (type) {
      case 'config': return this.maintenance.configurationPage()
      case 'network': return this.maintenance.networkSummary()
      case 'smear': return this.maintenance.cleanSmear()
      case 'quality':
      default: return this.maintenance.printQualityDiagnostics()
    }
  }

  // --- Power ---

  async powerCycle(): Promise<void> {
    await globalThis.fetch(`${this.baseUrl}/ProductActions/PowerCycle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml' },
      body: '<?xml version="1.0" encoding="UTF-8"?><prdact:PowerCycle xmlns:prdact="http://www.hp.com/schemas/imaging/con/ledm/prdact/2011/03/30">PowerCycle</prdact:PowerCycle>',
    })
  }

  // --- HP-specific accessors ---

  get firmwareManager(): HpFirmware {
    return this.firmware
  }

  get maintenanceManager(): HpMaintenance {
    return this.maintenance
  }
}

// --- Matcher & Factory ---

export const hpMatcher: DriverMatcher = (printer: DiscoveredPrinter | { model?: string, uri: string }) => {
  const model = ('model' in printer ? printer.model : undefined) ?? ''
  const name = ('name' in printer ? printer.name : '') ?? ''
  const uri = printer.uri

  const combined = `${model} ${name} ${uri}`.toLowerCase()
  return combined.includes('hp') || combined.includes('hewlett')
}

export const hpFactory: DriverFactory = (uri, host, name) =>
  new HpDriver(uri, host, name)

export { HpFirmware } from './firmware'
export { HpMaintenance } from './maintenance'
