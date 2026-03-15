// Re-export HP firmware for backward compatibility
// For new code, import from 'ts-printers/drivers/hp'
export { HpFirmware as FirmwareUpdater } from './drivers/hp/firmware'
export type { FirmwareInfo, FirmwareUpdateState, FirmwareUpdateConfig } from './drivers/hp/firmware'
