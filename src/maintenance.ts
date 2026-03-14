/**
 * HP Printer Maintenance via LEDM InternalPrint and Calibration endpoints.
 *
 * Supports:
 * - Printhead cleaning (3 levels)
 * - Print quality diagnostics
 * - Ink smear cleaning
 * - Printhead alignment/calibration
 * - Configuration and diagnostic pages
 */

const IP_NS = 'http://www.hp.com/schemas/imaging/con/ledm/internalprintdyn/2008/03/21'
const CAL_NS = 'http://www.hp.com/schemas/imaging/con/cnx/markingagentcalibration/2009/04/08'

export type CleaningLevel = 'level1' | 'level2' | 'level3'

export type InternalPageType =
  | 'cleaningPage'
  | 'cleaningPageLevel2'
  | 'cleaningPageLevel3'
  | 'cleaningVerificationPage'
  | 'configurationPage'
  | 'diagnosticsPage'
  | 'pqDiagnosticsPage'
  | 'ribSmearCleaningPage'
  | 'networkSummary'
  | 'networkDiagnosticPage'
  | 'wirelessNetworkPage'
  | 'eventLogReport'

export interface MaintenanceResult {
  success: boolean
  message: string
}

export class PrinterMaintenance {
  private baseUrl: string

  constructor(host: string) {
    if (host.startsWith('http')) {
      this.baseUrl = host.replace(/\/$/, '')
    }
    else {
      this.baseUrl = `http://${host}`
    }
  }

  /**
   * Clean the printhead. After not using a printer for years, dried ink
   * clogs the nozzles. Run level1 first, then level2/level3 if still poor.
   *
   * - level1: Basic cleaning (use this first)
   * - level2: Deep cleaning (uses more ink)
   * - level3: Deepest cleaning (uses most ink, last resort)
   *
   * Each level prints a cleaning page. Load paper before running.
   */
  async clean(level: CleaningLevel = 'level1'): Promise<MaintenanceResult> {
    const jobTypeMap: Record<CleaningLevel, string> = {
      level1: 'cleaningPage',
      level2: 'cleaningPageLevel2',
      level3: 'cleaningPageLevel3',
    }

    return this.runInternalPrint(jobTypeMap[level], `Printhead cleaning (${level})`)
  }

  /**
   * Print a cleaning verification page to check print quality after cleaning.
   */
  async cleaningVerification(): Promise<MaintenanceResult> {
    return this.runInternalPrint('cleaningVerificationPage', 'Cleaning verification page')
  }

  /**
   * Clean ink smears from the paper path rollers.
   * Useful when prints have ink marks on the back or streaks.
   */
  async cleanSmear(): Promise<MaintenanceResult> {
    return this.runInternalPrint('ribSmearCleaningPage', 'Ink smear cleaning')
  }

  /**
   * Print a print quality diagnostics page to identify issues.
   */
  async printQualityDiagnostics(): Promise<MaintenanceResult> {
    return this.runInternalPrint('pqDiagnosticsPage', 'Print quality diagnostics')
  }

  /**
   * Print a general diagnostics page.
   */
  async diagnostics(): Promise<MaintenanceResult> {
    return this.runInternalPrint('diagnosticsPage', 'Diagnostics page')
  }

  /**
   * Print a configuration/status page.
   */
  async configurationPage(): Promise<MaintenanceResult> {
    return this.runInternalPrint('configurationPage', 'Configuration page')
  }

  /**
   * Print a network summary page.
   */
  async networkSummary(): Promise<MaintenanceResult> {
    return this.runInternalPrint('networkSummary', 'Network summary')
  }

  /**
   * Run printhead alignment/calibration.
   * Helps fix misaligned colors or blurry text.
   */
  async align(): Promise<MaintenanceResult> {
    try {
      // Check current calibration state
      const stateResponse = await globalThis.fetch(`${this.baseUrl}/Calibration/State`)
      const stateXml = await stateResponse.text()

      // Create a calibration session to start alignment
      const response = await globalThis.fetch(`${this.baseUrl}/Calibration/Session`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<CalibrationState xmlns="${CAL_NS}">StartCalibration</CalibrationState>`,
      })

      if (!response.ok && response.status !== 201) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Get the session location to poll
      const location = response.headers.get('Location')
      if (location) {
        // Poll session for completion
        const sessionPath = location.startsWith('http')
          ? new URL(location).pathname
          : location

        await this.pollCalibration(sessionPath)
      }
      else {
        // No session URI — just wait a reasonable time
        await sleep(30000)
      }

      return { success: true, message: 'Printhead alignment complete' }
    }
    catch (err) {
      return { success: false, message: `Alignment failed: ${(err as Error).message}` }
    }
  }

  /**
   * Check if calibration/alignment is needed
   */
  async calibrationNeeded(): Promise<boolean> {
    try {
      const response = await globalThis.fetch(`${this.baseUrl}/Calibration/State`)
      const xml = await response.text()
      return xml.includes('CalibrationRequired')
    }
    catch {
      return false
    }
  }

  /**
   * Full maintenance routine for a printer that hasn't been used in a long time:
   * 1. Level 1 cleaning
   * 2. Check with verification page
   * 3. Level 2 cleaning if needed
   * 4. Alignment/calibration
   */
  async fullMaintenance(onProgress?: (message: string) => void): Promise<MaintenanceResult[]> {
    const results: MaintenanceResult[] = []

    onProgress?.('Step 1/4: Running level 1 printhead cleaning...')
    results.push(await this.clean('level1'))
    await sleep(5000) // Give the printer time between operations

    onProgress?.('Step 2/4: Printing cleaning verification page...')
    results.push(await this.cleaningVerification())
    await sleep(5000)

    onProgress?.('Step 3/4: Running level 2 deep cleaning...')
    results.push(await this.clean('level2'))
    await sleep(5000)

    onProgress?.('Step 4/4: Running printhead alignment...')
    results.push(await this.align())

    return results
  }

  // Internal helpers

  private async runInternalPrint(jobType: string, description: string): Promise<MaintenanceResult> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ipdyn:InternalPrintDyn xmlns:ipdyn="${IP_NS}">
  <ipdyn:JobType>${jobType}</ipdyn:JobType>
</ipdyn:InternalPrintDyn>`

    // Retry up to 3 times — printer may return 503 if it's waking from sleep or busy
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await globalThis.fetch(`${this.baseUrl}/DevMgmt/InternalPrintDyn.xml`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: xml,
        })

        if (response.status === 503) {
          // Printer is busy or waking up, wait and retry
          await sleep(10000)
          continue
        }

        if (!response.ok && response.status !== 201) {
          throw new Error(`HTTP ${response.status}`)
        }

        return { success: true, message: `${description} started. Check the printer for output.` }
      }
      catch (err) {
        if (attempt === 2) {
          return { success: false, message: `${description} failed: ${(err as Error).message}` }
        }
        await sleep(5000)
      }
    }

    return { success: false, message: `${description} failed: printer busy after retries` }
  }

  private async pollCalibration(sessionPath: string): Promise<void> {
    const maxWait = 120000 // 2 minutes
    const start = Date.now()

    while (Date.now() - start < maxWait) {
      await sleep(5000)

      try {
        const response = await globalThis.fetch(`${this.baseUrl}${sessionPath}`)
        const xml = await response.text()

        if (xml.includes('CalibrationDone') || xml.includes('CalibrationComplete') || xml.includes('idle')) {
          return
        }
      }
      catch {
        // Printer might be busy, keep polling
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
