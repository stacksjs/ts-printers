import type { PrintConfig } from './src/types'

const config: PrintConfig = {
  // Set your default printer URI here, or run `print discover` to find it
  // defaultPrinter: 'ipp://HP-Tango.local:631/ipp/print',

  // Named printers for quick access
  // printers: {
  //   tango: {
  //     uri: 'ipp://HP-Tango.local:631/ipp/print',
  //     name: 'HP Tango Exclusive',
  //   },
  // },

  verbose: false,
}

export default config
