/**
 * High-level Printer class.
 *
 * This is the main entry point for interacting with printers.
 * It auto-detects the printer vendor and uses the appropriate driver.
 *
 * For vendor-specific features (firmware, maintenance), use the driver directly:
 *   import { HpDriver } from 'ts-printers/drivers/hp'
 */

import type { PrintJob, PrintJobOptions, PrinterStatus } from './types'
import type { CleaningLevel, DriverCapabilities, FirmwareInfo, MaintenanceResult, ProgressCallback } from './drivers/base'
import { createDriverFromHost, createDriverFromUri, PrinterDriver } from './drivers'

export class Printer {
  private driver: PrinterDriver

  constructor(uri: string, name?: string) {
    this.driver = createDriverFromUri(uri, undefined, name)
  }

  get uri(): string { return this.driver.uri }
  get name(): string { return this.driver.name }
  get driverName(): string { return this.driver.driverName }

  capabilities(): DriverCapabilities { return this.driver.capabilities() }

  // --- Standard IPP operations ---
  status(): Promise<PrinterStatus> { return this.driver.status() }
  print(data: Buffer | Uint8Array, options?: PrintJobOptions): Promise<PrintJob> { return this.driver.print(data, options) }
  printFile(filePath: string, options?: PrintJobOptions): Promise<PrintJob> { return this.driver.printFile(filePath, options) }
  jobs(which?: 'completed' | 'not-completed' | 'all'): Promise<PrintJob[]> { return this.driver.jobs(which) }
  cancelJob(jobId: number): Promise<void> { return this.driver.cancelJob(jobId) }
  jobStatus(jobId: number): Promise<PrintJob> { return this.driver.jobStatus(jobId) }
  identify(): Promise<void> { return this.driver.identify() }
  validateJob(options?: PrintJobOptions): Promise<boolean> { return this.driver.validateJob(options) }

  // --- Vendor-specific (delegated to driver, throws if unsupported) ---
  getFirmwareInfo(): Promise<FirmwareInfo> { return this.driver.getFirmwareInfo() }
  updateFirmware(onProgress?: ProgressCallback): Promise<MaintenanceResult> { return this.driver.updateFirmware(onProgress) }
  uploadFirmware(filePath: string, onProgress?: ProgressCallback): Promise<MaintenanceResult> { return this.driver.uploadFirmware(filePath, onProgress) }
  clean(level?: CleaningLevel): Promise<MaintenanceResult> { return this.driver.clean(level) }
  align(): Promise<MaintenanceResult> { return this.driver.align() }
  fullMaintenance(onProgress?: ProgressCallback): Promise<MaintenanceResult[]> { return this.driver.fullMaintenance(onProgress) }
  diagnostic(type?: string): Promise<MaintenanceResult> { return this.driver.diagnostic(type) }
  powerCycle(): Promise<void> { return this.driver.powerCycle() }

  /**
   * Get the underlying driver for direct access to vendor-specific APIs
   */
  getDriver<T extends PrinterDriver = PrinterDriver>(): T {
    return this.driver as T
  }

  /**
   * Create a Printer from just a hostname (auto-detects vendor)
   */
  static async fromHost(host: string): Promise<Printer> {
    const printer = new Printer(`ipp://${host}:631/ipp/print`)
    printer.driver = await createDriverFromHost(host)
    return printer
  }
}
