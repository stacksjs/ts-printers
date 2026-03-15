import { CLI } from '@stacksjs/clapp'
import { version } from '../package.json'
import { discoverPrinters } from '../src/discovery'
import { Printer } from '../src/printer'
import { createDriverFromHost } from '../src/drivers'
import { getConfig } from '../src/config'

const cli = new CLI('print')

cli
  .command('discover', 'Discover printers on the local network')
  .option('--timeout <timeout>', 'Discovery timeout in ms', { default: '5000' })
  .option('--protocol <protocol>', 'Protocol to search: ipp, ipps, or both', { default: 'both' })
  .action(async (options?: { timeout?: string, protocol?: string }) => {
    const timeout = Number.parseInt(options?.timeout ?? '5000', 10)
    const protocol = (options?.protocol ?? 'both') as 'ipp' | 'ipps' | 'both'

    console.log('Searching for printers...\n')

    const printers = await discoverPrinters({ timeout, protocol })

    if (printers.length === 0) {
      console.log('No printers found. Make sure your printer is powered on and connected to the same network.')
      return
    }

    console.log(`Found ${printers.length} printer(s):\n`)

    for (const printer of printers) {
      console.log(`  ${printer.name}`)
      console.log(`    URI:      ${printer.uri}`)
      console.log(`    Host:     ${printer.host}:${printer.port}`)
      if (printer.model) console.log(`    Model:    ${printer.model}`)
      if (printer.location) console.log(`    Location: ${printer.location}`)
      console.log(`    Protocol: ${printer.protocol}`)
      console.log()
    }
  })

cli
  .command('status', 'Get printer status')
  .option('--printer <uri>', 'Printer URI (omit to use default from config)')
  .action(async (options?: { printer?: string }) => {
    const uri = await resolveUri(options?.printer)
    const printer = new Printer(uri)

    try {
      const status = await printer.status()

      console.log(`Printer: ${status.name}`)
      console.log(`Driver:  ${printer.driverName}`)
      console.log(`State:   ${status.state}`)
      if (status.stateReasons.length > 0) {
        console.log(`Reasons: ${status.stateReasons.join(', ')}`)
      }
      if (status.model) console.log(`Model:   ${status.model}`)
      if (status.location) console.log(`Location: ${status.location}`)
      console.log(`Color:   ${status.colorSupported ? 'yes' : 'no'}`)
      console.log(`Duplex:  ${status.duplexSupported ? 'yes' : 'no'}`)

      if (status.supportedFormats.length > 0) {
        console.log(`Formats: ${status.supportedFormats.join(', ')}`)
      }

      if (status.markerNames && status.markerNames.length > 0) {
        console.log('\nInk / Toner:')
        for (let i = 0; i < status.markerNames.length; i++) {
          const name = status.markerNames[i]
          const level = status.markerLevels?.[i]
          const levelStr = level !== undefined && level >= 0 ? `${level}%` : 'unknown'
          console.log(`  ${name}: ${levelStr}`)
        }
      }
    }
    catch (err) {
      console.error(`Failed to get status: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('send', 'Print a file')
  .option('--printer <uri>', 'Printer URI')
  .option('--copies <copies>', 'Number of copies', { default: '1' })
  .option('--quality <quality>', 'Print quality: draft, normal, high', { default: 'normal' })
  .option('--color <color>', 'Color mode: color, monochrome')
  .option('--sides <sides>', 'Sides: one-sided, two-sided-long-edge, two-sided-short-edge')
  .option('--media <media>', 'Media size (e.g. na_letter_8.5x11in, iso_a4_210x297mm)')
  .option('--orientation <orientation>', 'Orientation: portrait, landscape')
  .option('--name <name>', 'Job name')
  .option('--fit', 'Fit to page')
  .action(async (options?: Record<string, string | boolean | undefined>) => {
    const args = process.argv.slice(3)
    const filePath = args.find(a => !a.startsWith('-'))

    if (!filePath) {
      console.error('Usage: print send <file> [options]')
      process.exit(1)
    }

    const uri = await resolveUri(options?.printer as string)
    const printer = new Printer(uri)

    try {
      const job = await printer.printFile(filePath, {
        copies: options?.copies ? Number.parseInt(options.copies as string, 10) : undefined,
        quality: options?.quality as 'draft' | 'normal' | 'high' | undefined,
        colorMode: options?.color as 'color' | 'monochrome' | undefined,
        sides: options?.sides as 'one-sided' | 'two-sided-long-edge' | 'two-sided-short-edge' | undefined,
        media: options?.media as string | undefined,
        orientation: options?.orientation as 'portrait' | 'landscape' | undefined,
        jobName: options?.name as string | undefined,
        fitToPage: !!options?.fit,
      })

      console.log(`Job submitted successfully`)
      console.log(`  Job ID: ${job.id}`)
      console.log(`  State:  ${job.state}`)
      if (job.uri) console.log(`  URI:    ${job.uri}`)
    }
    catch (err) {
      console.error(`Print failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('jobs', 'List print jobs')
  .option('--printer <uri>', 'Printer URI')
  .option('--which <which>', 'Which jobs: completed, not-completed, all', { default: 'not-completed' })
  .action(async (options?: { printer?: string, which?: string }) => {
    const uri = await resolveUri(options?.printer)
    const printer = new Printer(uri)

    try {
      const jobs = await printer.jobs(options?.which as 'completed' | 'not-completed' | 'all')

      if (jobs.length === 0) {
        console.log('No jobs found.')
        return
      }

      console.log(`${jobs.length} job(s):\n`)
      for (const job of jobs) {
        console.log(`  #${job.id} - ${job.name}`)
        console.log(`    State: ${job.state}`)
        if (job.sheets) console.log(`    Sheets: ${job.sheets}`)
        console.log()
      }
    }
    catch (err) {
      console.error(`Failed to list jobs: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('cancel', 'Cancel a print job')
  .option('--printer <uri>', 'Printer URI')
  .action(async (options?: { printer?: string }) => {
    const args = process.argv.slice(3)
    const jobIdStr = args.find(a => !a.startsWith('-'))

    if (!jobIdStr) {
      console.error('Usage: print cancel <job-id> [options]')
      process.exit(1)
    }

    const jobId = Number.parseInt(jobIdStr, 10)
    if (Number.isNaN(jobId)) {
      console.error('Invalid job ID')
      process.exit(1)
    }

    const uri = await resolveUri(options?.printer)
    const printer = new Printer(uri)

    try {
      await printer.cancelJob(jobId)
      console.log(`Job #${jobId} cancelled.`)
    }
    catch (err) {
      console.error(`Failed to cancel job: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('identify', 'Make the printer identify itself (beep/flash)')
  .option('--printer <uri>', 'Printer URI')
  .action(async (options?: { printer?: string }) => {
    const uri = await resolveUri(options?.printer)
    const printer = new Printer(uri)

    try {
      await printer.identify()
      console.log('Identify request sent.')
    }
    catch (err) {
      console.error(`Identify failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

// --- Firmware commands (driver-based) ---

cli
  .command('firmware', 'Manage printer firmware')
  .option('--host <host>', 'Printer hostname or IP')
  .action(async (options?: { host?: string }) => {
    const host = await resolveHost(options?.host)
    const driver = await createDriverFromHost(host)

    try {
      const info = await driver.getFirmwareInfo()

      console.log('Firmware Information')
      console.log(`  Driver:          ${driver.driverName}`)
      console.log(`  Model:           ${info.model}`)
      console.log(`  Serial:          ${info.serialNumber}`)
      console.log(`  Product:         ${info.productNumber}`)
      console.log(`  Version:         ${info.currentVersion}`)
      console.log(`  Date:            ${info.currentDate}`)
    }
    catch (err) {
      console.error(`Failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('firmware:update', 'Download and install latest firmware automatically')
  .option('--host <host>', 'Printer hostname or IP')
  .action(async (options?: { host?: string }) => {
    const host = await resolveHost(options?.host)
    const driver = await createDriverFromHost(host)

    try {
      const result = await driver.updateFirmware((msg) => {
        console.log(msg)
      })

      console.log(`\n${result.success ? 'Success' : 'Failed'}: ${result.message}`)
      if (!result.success) process.exit(1)
    }
    catch (err) {
      console.error(`Update failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('firmware:upload', 'Upload a firmware file directly to the printer')
  .option('--host <host>', 'Printer hostname or IP')
  .action(async (options?: { host?: string }) => {
    const args = process.argv.slice(3)
    const filePath = args.find(a => !a.startsWith('-'))

    if (!filePath) {
      console.error('Usage: print firmware:upload <firmware-file> --host <host>')
      process.exit(1)
    }

    const host = await resolveHost(options?.host)
    const driver = await createDriverFromHost(host)

    console.log(`Uploading firmware from ${filePath}...`)

    try {
      const result = await driver.uploadFirmware(filePath, (msg) => {
        console.log(msg)
      })

      console.log(`\n${result.success ? 'Success' : 'Failed'}: ${result.message}`)
      if (!result.success) process.exit(1)
    }
    catch (err) {
      console.error(`Upload failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

// --- Maintenance commands (driver-based) ---

cli
  .command('clean', 'Clean the printhead (fixes poor print quality)')
  .option('--host <host>', 'Printer hostname or IP')
  .option('--level <level>', 'Cleaning level: 1, 2, or 3 (default: 1)', { default: '1' })
  .action(async (options?: { host?: string, level?: string }) => {
    const host = await resolveHost(options?.host)
    const driver = await createDriverFromHost(host)

    const levelMap: Record<string, 'level1' | 'level2' | 'level3'> = { '1': 'level1', '2': 'level2', '3': 'level3' }
    const level = levelMap[options?.level ?? '1'] || 'level1'

    console.log(`Running printhead cleaning (${level}) via ${driver.driverName} driver...`)
    console.log('Make sure paper is loaded.\n')

    try {
      const result = await driver.clean(level)
      console.log(result.success ? result.message : `Failed: ${result.message}`)
      if (!result.success) process.exit(1)
    }
    catch (err) {
      console.error(`Clean failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('align', 'Align the printhead (fixes blurry text or misaligned colors)')
  .option('--host <host>', 'Printer hostname or IP')
  .action(async (options?: { host?: string }) => {
    const host = await resolveHost(options?.host)
    const driver = await createDriverFromHost(host)

    console.log('Running printhead alignment...')
    console.log('Make sure paper is loaded.\n')

    try {
      const result = await driver.align()
      console.log(result.success ? result.message : `Failed: ${result.message}`)
      if (!result.success) process.exit(1)
    }
    catch (err) {
      console.error(`Align failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('maintain', 'Full maintenance routine (clean + align)')
  .option('--host <host>', 'Printer hostname or IP')
  .action(async (options?: { host?: string }) => {
    const host = await resolveHost(options?.host)
    const driver = await createDriverFromHost(host)

    console.log(`Running full maintenance via ${driver.driverName} driver...`)
    console.log('Make sure paper is loaded. This will print several pages.\n')

    try {
      const results = await driver.fullMaintenance((msg) => {
        console.log(msg)
      })

      console.log('\nResults:')
      for (const r of results) {
        console.log(`  ${r.success ? 'OK' : 'FAIL'}: ${r.message}`)
      }
    }
    catch (err) {
      console.error(`Maintenance failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli
  .command('diagnostic', 'Print a diagnostic or info page')
  .option('--host <host>', 'Printer hostname or IP')
  .option('--type <type>', 'Page type: quality, config, network, smear', { default: 'quality' })
  .action(async (options?: { host?: string, type?: string }) => {
    const host = await resolveHost(options?.host)
    const driver = await createDriverFromHost(host)

    try {
      const result = await driver.diagnostic(options?.type)
      console.log(result.success ? result.message : `Failed: ${result.message}`)
      if (!result.success) process.exit(1)
    }
    catch (err) {
      console.error(`Diagnostic failed: ${(err as Error).message}`)
      process.exit(1)
    }
  })

cli.command('version', 'Show the version of the CLI').action(() => {
  console.log(version)
})

cli.version(version)
cli.help()
cli.parse()

// --- Helpers ---

async function resolveUri(explicitUri?: string): Promise<string> {
  if (explicitUri) return explicitUri

  try {
    const config = await getConfig()
    if (config.defaultPrinter) {
      if (config.printers?.[config.defaultPrinter]) {
        return config.printers[config.defaultPrinter].uri
      }
      return config.defaultPrinter
    }
  }
  catch {
    // No config file
  }

  console.log('No printer specified. Discovering...')
  const printers = await discoverPrinters({ timeout: 5000 })

  if (printers.length === 0) {
    console.error('No printers found. Use --printer <uri> or set defaultPrinter in print.config.ts')
    process.exit(1)
  }

  if (printers.length === 1) {
    console.log(`Using: ${printers[0].name} (${printers[0].uri})\n`)
    return printers[0].uri
  }

  console.log('Multiple printers found:')
  for (let i = 0; i < printers.length; i++) {
    console.log(`  [${i + 1}] ${printers[i].name} - ${printers[i].uri}`)
  }
  console.log('\nUsing first printer. To specify, use --printer <uri> or set defaultPrinter in print.config.ts\n')
  return printers[0].uri
}

async function resolveHost(explicitHost?: string): Promise<string> {
  if (explicitHost) return explicitHost

  console.log('No host specified. Discovering printers...')
  const printers = await discoverPrinters({ timeout: 5000 })

  if (printers.length === 0) {
    console.error('No printers found. Use --host <hostname-or-ip>')
    process.exit(1)
  }

  const host = printers[0].host
  console.log(`Using: ${printers[0].name} (${host})\n`)
  return host
}
