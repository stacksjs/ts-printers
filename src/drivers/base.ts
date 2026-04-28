/**
 * Base printer driver interface.
 *
 * Every printer manufacturer/model driver implements this interface.
 * The generic IPP driver handles standard operations; vendor-specific
 * drivers (HP, Canon, Brother, etc.) extend it with firmware updates,
 * maintenance, and model-specific features.
 */

import type { DiscoveredPrinter, PrintJob, PrintJobOptions, PrinterStatus } from '../types'

// Driver capabilities — drivers declare what they support
export interface DriverCapabilities {
  printing: boolean
  scanning: boolean
  firmware: boolean
  maintenance: boolean
  identify: boolean
}

export interface FirmwareInfo {
  currentVersion: string
  currentDate: string
  model: string
  serialNumber: string
  productNumber: string
  latestVersion?: string
  updateAvailable?: boolean
}

export interface MaintenanceResult {
  success: boolean
  message: string
}

export type CleaningLevel = 'level1' | 'level2' | 'level3'

// eslint-disable-next-line pickier/no-unused-vars
export type ProgressCallback = (message: string) => void

/**
 * Abstract base driver. All printer drivers extend this.
 */
export abstract class PrinterDriver {
  abstract readonly driverName: string

  constructor(
    readonly uri: string,
    readonly host: string,
    readonly name: string,
  ) {}

  abstract capabilities(): DriverCapabilities

  // --- Printing (standard IPP) ---
  abstract status(): Promise<PrinterStatus>
  abstract print(data: Buffer | Uint8Array, options?: PrintJobOptions): Promise<PrintJob>
  abstract printFile(filePath: string, options?: PrintJobOptions): Promise<PrintJob>
  abstract jobs(which?: 'completed' | 'not-completed' | 'all'): Promise<PrintJob[]>
  abstract cancelJob(jobId: number): Promise<void>
  abstract jobStatus(jobId: number): Promise<PrintJob>

  // --- Optional features (override in vendor drivers) ---

  async identify(): Promise<void> {
    throw new Error(`${this.driverName} driver does not support identify`)
  }

  async validateJob(_options?: PrintJobOptions): Promise<boolean> {
    return true
  }

  // --- Firmware (vendor-specific) ---

  async getFirmwareInfo(): Promise<FirmwareInfo> {
    throw new Error(`${this.driverName} driver does not support firmware management`)
  }

  async updateFirmware(_onProgress?: ProgressCallback): Promise<MaintenanceResult> {
    throw new Error(`${this.driverName} driver does not support firmware updates`)
  }

  async uploadFirmware(_filePath: string, _onProgress?: ProgressCallback): Promise<MaintenanceResult> {
    throw new Error(`${this.driverName} driver does not support firmware uploads`)
  }

  // --- Maintenance (vendor-specific) ---

  async clean(_level?: CleaningLevel): Promise<MaintenanceResult> {
    throw new Error(`${this.driverName} driver does not support printhead cleaning`)
  }

  async align(): Promise<MaintenanceResult> {
    throw new Error(`${this.driverName} driver does not support printhead alignment`)
  }

  async fullMaintenance(_onProgress?: ProgressCallback): Promise<MaintenanceResult[]> {
    throw new Error(`${this.driverName} driver does not support maintenance routines`)
  }

  async diagnostic(_type?: string): Promise<MaintenanceResult> {
    throw new Error(`${this.driverName} driver does not support diagnostics`)
  }

  // --- Power management ---

  async powerCycle(): Promise<void> {
    throw new Error(`${this.driverName} driver does not support power cycle`)
  }
}

/**
 * Driver factory function signature.
 * Given a discovered printer (or manual config), returns the appropriate driver.
 */
// eslint-disable-next-line pickier/no-unused-vars
export type DriverFactory = (uri: string, host: string, name: string) => PrinterDriver

/**
 * Driver match function — returns true if this driver can handle the given printer.
 */
// eslint-disable-next-line pickier/no-unused-vars
export type DriverMatcher = (printer: DiscoveredPrinter | { model?: string, uri: string }) => boolean
