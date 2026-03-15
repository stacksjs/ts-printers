// Core
export * from './config'
export * from './types'
export * from './discovery'
export * from './printer'

// Drivers
export * from './drivers'

// IPP Protocol
export * from './ipp'

// Backward compatibility re-exports
export { FirmwareUpdater } from './firmware'
export type { FirmwareInfo, FirmwareUpdateState, FirmwareUpdateConfig } from './firmware'
export { PrinterMaintenance } from './maintenance'
export type { CleaningLevel, MaintenanceResult } from './maintenance'
