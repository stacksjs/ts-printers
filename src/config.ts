import type { PrintConfig } from './types'
import { loadConfig } from 'bunfig'

export const defaultConfig: PrintConfig = {
  verbose: false,
  timeout: 10000,
}

let _config: PrintConfig | null = null

export async function getConfig(): Promise<PrintConfig> {
  if (!_config) {
    _config = await loadConfig({
      name: 'print',
      defaultConfig,
    })
  }
  return _config
}

export const config: PrintConfig = defaultConfig
