/**
 * HP Printer Firmware Update via LEDM + direct PJL upload
 *
 * Supports three methods:
 * 1. WebFWUpdate: Printer checks HP servers for updates (requires printer internet access)
 * 2. Automated download + upload: Downloads firmware from HP's FTP, sends via port 9100
 * 3. Manual upload: Push a .ful/.ful2 firmware file to the printer
 */

import { connect } from 'net'

export interface FirmwareInfo {
  currentVersion: string
  currentDate: string
  model: string
  serialNumber: string
  productNumber: string
  firmwareDownloadId: string
}

export interface FirmwareUpdateState {
  status: string
  error?: string
  targetVersion?: string
  targetDate?: string
  reason?: string
  type?: string
  progress?: number
  sessionUri?: string
}

export interface FirmwareUpdateConfig {
  automaticCheck: boolean
  automaticUpdate: boolean
}

// Known HP firmware download locations
// Pattern: https://ftp.hp.com/pub/softlib/software13/printers/{product}/{version}/{filename}.exe
const HP_FIRMWARE_REGISTRY: Record<string, FirmwareEntry> = {
  tango: {
    model: 'HP Tango',
    productNumber: '3DP64A',
    latestVersion: 'INFNTYLP2N001.2330A.00',
    downloadUrl: 'https://ftp.hp.com/pub/softlib/software13/printers/tango/2330/Tango_R2330A.exe',
    firmwareFilename: 'infinity_dist_lp2_001.2330A_nonassert_appsigned_lbi_rootfs_secure_signed.ful2',
    sevenZipOffset: 364851,
  },
}

interface FirmwareEntry {
  model: string
  productNumber: string
  latestVersion: string
  downloadUrl: string
  firmwareFilename: string
  sevenZipOffset: number
}

const FW_NS = 'http://www.hp.com/schemas/imaging/con/ledm/firmwareupdatedyn/2010/12/12'

export class HpFirmware {
  private baseUrl: string
  private host: string

  constructor(host: string) {
    this.host = host.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/:\d+$/, '')
    if (host.startsWith('http')) {
      this.baseUrl = host.replace(/\/$/, '')
    }
    else {
      this.baseUrl = `http://${host}`
    }
  }

  /**
   * Get current firmware information from the printer
   */
  async getInfo(): Promise<FirmwareInfo> {
    const response = await this.fetch('/DevMgmt/ProductConfigDyn.xml')
    const xml = await response.text()

    return {
      currentVersion: extractXml(xml, 'dd:Revision', 1) || 'unknown',
      currentDate: extractXml(xml, 'dd:Date', 1) || 'unknown',
      model: extractXml(xml, 'dd:MakeAndModel') || 'unknown',
      serialNumber: extractXml(xml, 'dd:SerialNumber') || 'unknown',
      productNumber: extractXml(xml, 'dd:ProductNumber') || 'unknown',
      firmwareDownloadId: extractXml(xml, 'dd:FirmwareDownloadID') || '',
    }
  }

  /**
   * Get the current firmware update state
   */
  async getState(): Promise<FirmwareUpdateState> {
    const response = await this.fetch('/FirmwareUpdate/WebFWUpdate/State')
    const xml = await response.text()

    return {
      status: extractXml(xml, 'fwudyn:Status') || 'unknown',
      error: extractXml(xml, 'fwudyn:Error') || undefined,
      targetVersion: extractXml(xml, 'dd:Revision') || undefined,
      targetDate: extractXml(xml, 'dd:Date') || undefined,
      reason: extractXml(xml, 'fwudyn:UpdateReason') || undefined,
      type: extractXml(xml, 'fwudyn:Type') || undefined,
      progress: extractXmlNumber(xml, 'fwudyn:ProgressPercentage'),
      sessionUri: extractXml(xml, 'fwudyn:SessionURI') || undefined,
    }
  }

  /**
   * Get firmware auto-update configuration
   */
  async getConfig(): Promise<FirmwareUpdateConfig> {
    const response = await this.fetch('/FirmwareUpdate/WebFWUpdate/Config')
    const xml = await response.text()

    return {
      automaticCheck: extractXml(xml, 'fwudyn:AutomaticCheck') === 'enabled',
      automaticUpdate: extractXml(xml, 'fwudyn:AutomaticUpdate') === 'enabled',
    }
  }

  /**
   * Set firmware auto-update configuration
   */
  async setConfig(config: Partial<FirmwareUpdateConfig>): Promise<void> {
    const autoCheck = config.automaticCheck !== undefined
      ? (config.automaticCheck ? 'enabled' : 'disabled')
      : 'enabled'
    const autoUpdate = config.automaticUpdate !== undefined
      ? (config.automaticUpdate ? 'enabled' : 'disabled')
      : 'enabled'

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fwudyn:FirmwareUpdateConfig xmlns:fwudyn="${FW_NS}">
  <fwudyn:AutomaticCheck>${autoCheck}</fwudyn:AutomaticCheck>
  <fwudyn:AutomaticUpdate>${autoUpdate}</fwudyn:AutomaticUpdate>
</fwudyn:FirmwareUpdateConfig>`

    await this.fetchPut('/FirmwareUpdate/WebFWUpdate/Config', xml)
  }

  /**
   * Reset the firmware update state (clears errors)
   */
  async reset(): Promise<void> {
    await this.sendAction('reset')
  }

  /**
   * Tell the printer to check HP's servers for a firmware update
   */
  async check(): Promise<FirmwareUpdateState> {
    await this.reset()
    await sleep(1000)
    await this.sendAction('check')
    return this.pollState(['idle', 'available', 'notAvailable', 'checkFailed'], 60000)
  }

  /**
   * Start the firmware update (after check found an update via HP servers)
   */
  async startUpdate(): Promise<FirmwareUpdateState> {
    await this.sendAction('start')
    return this.pollState(['idle', 'installSuccess', 'installFailed', 'downloadFailed'], 600000)
  }

  /**
   * Cancel an in-progress firmware update
   */
  async cancel(): Promise<void> {
    await this.sendAction('cancel')
  }

  /**
   * Fully automated firmware update:
   * 1. Reads printer info to determine model
   * 2. Checks if firmware is outdated
   * 3. Downloads latest firmware from HP's servers (our side, not printer's)
   * 4. Extracts the .ful2 from the self-extracting archive
   * 5. Sends it to the printer via port 9100 (PJL)
   */
  async autoUpdate(onProgress?: (message: string) => void): Promise<{ success: boolean, message: string }> {
    // Step 1: Get printer info
    onProgress?.('Reading printer information...')
    const info = await this.getInfo()
    onProgress?.(`  Model: ${info.model}`)
    onProgress?.(`  Current firmware: ${info.currentVersion} (${info.currentDate})`)

    // Step 2: Find matching firmware entry
    const entry = findFirmwareEntry(info)
    if (!entry) {
      return {
        success: false,
        message: `No firmware update available for model: ${info.model} (${info.productNumber}). Only HP Tango is currently supported for automated updates.`,
      }
    }

    // Step 3: Check if update is needed
    if (info.currentVersion === entry.latestVersion) {
      return {
        success: true,
        message: `Firmware is already up to date: ${info.currentVersion}`,
      }
    }

    onProgress?.(`  Latest available: ${entry.latestVersion}`)
    onProgress?.('')

    // Step 4: Download firmware from HP
    onProgress?.('Downloading firmware from HP...')
    const fwData = await downloadAndExtractFirmware(entry, onProgress)
    onProgress?.(`  Firmware extracted: ${(fwData.length / 1024 / 1024).toFixed(1)} MB`)

    // Step 5: Send firmware to printer
    onProgress?.('')
    onProgress?.('Sending firmware to printer...')
    onProgress?.('  (Do NOT power off the printer during this process.)')

    await this.sendFirmware(fwData, onProgress)

    // Step 6: Wait for printer to start installing and come back online
    onProgress?.('')
    onProgress?.('Waiting for printer to install firmware and restart...')
    onProgress?.('  (This typically takes 5-10 minutes)')

    const finalVersion = await this.waitForReboot(info.currentVersion, entry.latestVersion, onProgress)

    if (finalVersion === entry.latestVersion) {
      return {
        success: true,
        message: `Firmware updated successfully: ${info.currentVersion} -> ${finalVersion}`,
      }
    }
    else if (finalVersion && finalVersion !== info.currentVersion) {
      return {
        success: true,
        message: `Firmware changed: ${info.currentVersion} -> ${finalVersion}`,
      }
    }
    else {
      return {
        success: false,
        message: `Firmware may not have been applied. Current version: ${finalVersion || 'unknown'}. Try running the update again.`,
      }
    }
  }

  /**
   * Upload a firmware file (.ful/.ful2) directly to the printer via port 9100.
   */
  async uploadFirmware(firmwareData: Buffer | Uint8Array, onProgress?: (message: string) => void): Promise<{ success: boolean, message: string }> {
    const buf = Buffer.isBuffer(firmwareData) ? firmwareData : Buffer.from(firmwareData)

    // Check if it's a PJL firmware file
    const header = buf.subarray(0, 50).toString('ascii')
    if (!header.includes('@PJL') && !header.includes('FWUPDATE')) {
      return {
        success: false,
        message: 'File does not appear to be a valid firmware file (missing PJL/FWUPDATE header)',
      }
    }

    onProgress?.('Sending firmware to printer via port 9100...')
    onProgress?.('  (This may take several minutes. Do NOT power off the printer.)')

    await sendToPort9100(this.host, buf, onProgress)

    return {
      success: true,
      message: 'Firmware sent. The printer will install and restart.',
    }
  }

  /**
   * Upload firmware from a file path
   */
  async uploadFirmwareFile(filePath: string, onProgress?: (message: string) => void): Promise<{ success: boolean, message: string }> {
    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      throw new Error(`Firmware file not found: ${filePath}`)
    }
    const data = Buffer.from(await file.arrayBuffer())
    return this.uploadFirmware(data, onProgress)
  }

  /**
   * Full update flow: try auto-update first, fall back to cloud check
   */
  async checkAndUpdate(onProgress?: (state: FirmwareUpdateState) => void): Promise<FirmwareUpdateState> {
    onProgress?.({ status: 'checking' })
    const checkResult = await this.check()
    onProgress?.(checkResult)

    if (checkResult.status === 'available') {
      onProgress?.({ status: 'starting update...' })
      const updateResult = await this.startUpdate()
      onProgress?.(updateResult)
      return updateResult
    }

    return checkResult
  }

  /**
   * Send firmware to the printer:
   * 1. Put printer in recovery/firmware mode via LEDM
   * 2. Wait for it to reboot into recovery mode
   * 3. Send .ful2 via port 9100 (PJL FWUPDATE2 is handled in recovery mode)
   */
  private async sendFirmware(data: Buffer, onProgress?: (message: string) => void): Promise<void> {
    // Step 1: Put printer into firmware/recovery mode
    onProgress?.('  Setting printer to firmware update mode...')
    await this.fetchPut('/FirmwareUpdate/FirmwareMode',
      `<?xml version="1.0" encoding="UTF-8"?><fwudyn:FirmwareMode xmlns:fwudyn="${FW_NS}">recovery</fwudyn:FirmwareMode>`)

    // Step 2: Wait for printer to reboot into recovery mode
    onProgress?.('  Waiting for printer to enter recovery mode...')
    const ip = await this.resolveIp()
    await sleep(15000)

    // Wait for port 9100 to become available in recovery mode
    await waitForPort(ip, 9100, 120000)
    onProgress?.('  Printer is in recovery mode.')

    // Step 3: Send firmware via port 9100
    onProgress?.(`  Sending ${(data.length / 1024 / 1024).toFixed(1)} MB via port 9100...`)
    await sendToPort9100(ip, data, onProgress)
  }

  /**
   * Resolve the printer's IP address from hostname
   */
  private async resolveIp(): Promise<string> {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(this.host)) return this.host

    try {
      const proc = Bun.spawn(['ping', '-c', '1', '-t', '5', this.host], { stdout: 'pipe', stderr: 'pipe' })
      const output = await new Response(proc.stdout).text()
      const match = output.match(/\((\d+\.\d+\.\d+\.\d+)\)/)
      if (match) return match[1]
    }
    catch { /* fall through */ }

    return this.host
  }

  /**
   * Wait for the printer to reboot after firmware update and verify the new version.
   * Polls the printer every 15 seconds for up to 10 minutes.
   */
  private async waitForReboot(
    oldVersion: string,
    expectedVersion: string,
    onProgress?: (message: string) => void,
  ): Promise<string | null> {
    const maxWaitMs = 600000 // 10 minutes
    const pollIntervalMs = 15000 // 15 seconds
    const start = Date.now()
    let lastStatus = ''

    while (Date.now() - start < maxWaitMs) {
      await sleep(pollIntervalMs)

      try {
        const info = await this.getInfo()

        if (info.currentVersion !== oldVersion) {
          onProgress?.(`  Firmware updated to: ${info.currentVersion}`)
          return info.currentVersion
        }

        // Printer is back but still on old version — might still be finishing
        if (lastStatus !== 'online-old') {
          onProgress?.('  Printer is online, waiting for firmware to apply...')
          lastStatus = 'online-old'
        }
      }
      catch {
        // Printer is offline (rebooting) — this is expected
        const elapsed = Math.floor((Date.now() - start) / 1000)
        if (lastStatus !== 'offline') {
          onProgress?.(`  Printer is rebooting... (${elapsed}s elapsed)`)
          lastStatus = 'offline'
        }
      }
    }

    // Final check
    try {
      const info = await this.getInfo()
      return info.currentVersion
    }
    catch {
      return null
    }
  }

  // Internal helpers

  private async sendAction(action: 'check' | 'start' | 'cancel' | 'reset'): Promise<void> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fwudyn:FirmwareUpdateState xmlns:fwudyn="${FW_NS}">
  <fwudyn:UpdateAction>${action}</fwudyn:UpdateAction>
</fwudyn:FirmwareUpdateState>`

    await this.fetchPut('/FirmwareUpdate/WebFWUpdate/StateAction', xml)
  }

  private async pollState(terminalStatuses: string[], timeoutMs: number): Promise<FirmwareUpdateState> {
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      await sleep(2000)
      const state = await this.getState()
      if (terminalStatuses.includes(state.status)) {
        return state
      }
    }

    return this.getState()
  }

  private async fetch(path: string): Promise<Response> {
    const response = await globalThis.fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { 'Accept': 'text/xml, application/xml' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${path}`)
    }

    return response
  }

  private async fetchPut(path: string, xmlBody: string): Promise<Response> {
    const response = await globalThis.fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlBody,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from PUT ${path}`)
    }

    return response
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  private async fetchPost(path: string, xmlBody: string): Promise<Response> {
    const response = await globalThis.fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlBody,
    })

    if (!response.ok && response.status !== 201) {
      throw new Error(`HTTP ${response.status} from POST ${path}`)
    }

    return response
  }
}

// Firmware registry helpers

function findFirmwareEntry(info: FirmwareInfo): FirmwareEntry | undefined {
  // Match by model name
  const modelLower = info.model.toLowerCase()
  for (const [key, entry] of Object.entries(HP_FIRMWARE_REGISTRY)) {
    if (modelLower.includes(key) || info.productNumber === entry.productNumber) {
      return entry
    }
  }
  return undefined
}

/**
 * Download firmware from HP's FTP server and extract the .ful2 file
 * from the self-extracting 7z archive
 */
async function downloadAndExtractFirmware(
  entry: FirmwareEntry,
  onProgress?: (message: string) => void,
): Promise<Buffer> {
  // Download the .exe file
  onProgress?.(`  URL: ${entry.downloadUrl}`)

  const response = await globalThis.fetch(entry.downloadUrl)
  if (!response.ok) {
    throw new Error(`Failed to download firmware: HTTP ${response.status}`)
  }

  const exeData = Buffer.from(await response.arrayBuffer())
  onProgress?.(`  Downloaded: ${(exeData.length / 1024 / 1024).toFixed(1)} MB`)

  // Find the 7z archive within the exe
  // 7z signature: 37 7A BC AF 27 1C
  const sevenZipSig = Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])
  let archiveOffset = entry.sevenZipOffset

  // Verify the signature at the expected offset
  if (!exeData.subarray(archiveOffset, archiveOffset + 6).equals(sevenZipSig)) {
    // Search for it
    archiveOffset = findBuffer(exeData, sevenZipSig)
    if (archiveOffset === -1) {
      throw new Error('Could not find 7z archive within firmware package')
    }
  }

  onProgress?.('  Extracting firmware from archive...')

  // Extract the 7z archive to a temp dir
  const tempExe = `/tmp/ts-printers-fw-${Date.now()}.7z`
  const tempDir = `/tmp/ts-printers-fw-${Date.now()}`

  await Bun.write(tempExe, exeData.subarray(archiveOffset))

  // Use 7z to extract (check if available, try p7zip or bsdtar)
  const extractor = await findExtractor()

  const proc = Bun.spawn([...extractor, tempExe, `-o${tempDir}`, '-y'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await proc.exited

  // Find the .ful2 file
  const firmwarePath = `${tempDir}/${entry.firmwareFilename}`
  const firmwareFile = Bun.file(firmwarePath)

  if (!(await firmwareFile.exists())) {
    // Search for any .ful or .ful2 file
    const foundPath = await findFirmwareFile(tempDir)
    if (!foundPath) {
      throw new Error(`Firmware file not found in archive. Expected: ${entry.firmwareFilename}`)
    }
    const data = Buffer.from(await Bun.file(foundPath).arrayBuffer())
    await cleanup(tempExe, tempDir)
    return data
  }

  const data = Buffer.from(await firmwareFile.arrayBuffer())

  // Cleanup
  await cleanup(tempExe, tempDir)

  return data
}

async function findExtractor(): Promise<string[]> {
  // Try 7z first
  for (const cmd of ['7z', '7za', '7zz']) {
    const proc = Bun.spawn(['which', cmd], { stdout: 'pipe', stderr: 'pipe' })
    if ((await proc.exited) === 0) {
      return [cmd, 'x']
    }
  }

  // Try bsdtar (available on macOS)
  const bsdtar = Bun.spawn(['which', 'bsdtar'], { stdout: 'pipe', stderr: 'pipe' })
  if ((await bsdtar.exited) === 0) {
    return ['bsdtar', 'xf']
  }

  throw new Error(
    'No 7z extractor found. Install p7zip: brew install p7zip',
  )
}

async function findFirmwareFile(dir: string): Promise<string | null> {
  const proc = Bun.spawn(['find', dir, '-name', '*.ful2', '-o', '-name', '*.ful'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const output = await new Response(proc.stdout).text()
  const files = output.trim().split('\n').filter(Boolean)
  return files[0] || null
}

async function cleanup(tempExe: string, tempDir: string): Promise<void> {
  try {
    const rm1 = Bun.spawn(['rm', '-f', tempExe], { stdout: 'pipe', stderr: 'pipe' })
    const rm2 = Bun.spawn(['rm', '-rf', tempDir], { stdout: 'pipe', stderr: 'pipe' })
    await Promise.all([rm1.exited, rm2.exited])
  }
  catch {
    // Best effort cleanup
  }
}

/**
 * Send firmware data to the printer via raw TCP port 9100.
 * The printer must be in recovery/firmware mode for this to work as a firmware update.
 */
function sendToPort9100(
  host: string,
  data: Buffer,
  onProgress?: (message: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false

    const socket = connect({ host, port: 9100 }, () => {
      onProgress?.('  Connected. Transferring firmware...')

      socket.write(data, () => {
        onProgress?.('  All data written. Waiting for printer to acknowledge...')
        socket.end()
      })
    })

    // Report progress periodically
    let lastPct = 0
    const progressInterval = setInterval(() => {
      const pct = Math.floor((socket.bytesWritten / data.length) * 100)
      if (pct > lastPct + 9) {
        lastPct = pct
        onProgress?.(`  Progress: ${pct}%`)
      }
    }, 3000)

    function done(msg: string): void {
      if (!resolved) {
        resolved = true
        clearInterval(progressInterval)
        onProgress?.(msg)
        resolve()
      }
    }

    socket.on('close', () => done('  Transfer complete.'))
    socket.on('end', () => { /* printer sent FIN */ })
    socket.on('data', () => { /* consume responses */ })

    socket.setTimeout(600000)
    socket.on('timeout', () => { socket.destroy(); done('  Timeout (data sent, printer processing).') })
    socket.on('error', (err) => {
      clearInterval(progressInterval)
      if (!resolved) {
        resolved = true
        if (err.message.includes('ECONNRESET')) {
          onProgress?.('  Printer reset connection (normal during install).')
          resolve()
        }
        else {
          reject(new Error(`Connection error: ${err.message}`))
        }
      }
    })
  })
}

/**
 * Wait for a TCP port to become available on a host
 */
async function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = connect({ host, port }, () => { s.destroy(); resolve() })
        s.on('error', () => { s.destroy(); reject() })
        s.setTimeout(3000, () => { s.destroy(); reject() })
      })
      return
    }
    catch {
      await sleep(5000)
    }
  }
  throw new Error(`Timeout waiting for ${host}:${port}`)
}

// Utility helpers

function findBuffer(haystack: Buffer, needle: Buffer): number {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (haystack.subarray(i, i + needle.length).equals(needle)) {
      return i
    }
  }
  return -1
}

function extractXml(xml: string, tag: string, occurrence = 0): string | undefined {
  const regex = new RegExp(`<${escapeRegex(tag)}[^>]*>([^<]*)</${escapeRegex(tag)}>`, 'g')
  let match: RegExpExecArray | null
  let count = 0
  while ((match = regex.exec(xml)) !== null) {
    if (count === occurrence) {
      return match[1].trim()
    }
    count++
  }
  return undefined
}

function extractXmlNumber(xml: string, tag: string): number | undefined {
  const val = extractXml(xml, tag)
  if (val === undefined) return undefined
  const num = Number.parseInt(val, 10)
  return Number.isNaN(num) ? undefined : num
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
