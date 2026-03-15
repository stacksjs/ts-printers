// Re-export HP maintenance for backward compatibility
// For new code, import from 'ts-printers/drivers/hp'
export { HpMaintenance as PrinterMaintenance } from './drivers/hp/maintenance'
export type { CleaningLevel, InternalPageType, MaintenanceResult } from './drivers/hp/maintenance'
