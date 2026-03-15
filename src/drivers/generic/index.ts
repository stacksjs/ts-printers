/**
 * Generic IPP printer driver.
 *
 * Handles any IPP-compatible printer with standard operations:
 * printing, job management, status, and identify.
 * No vendor-specific features (firmware, maintenance).
 */

import type { DiscoveredPrinter, IppAttributeGroup, IppAttributeValue, IppResponse, PrintJob, PrintJobOptions, PrinterStatus } from '../../types'
import { IppOperation, IppTag, OrientationMap, QualityMap } from '../../types'
import { IppClient } from '../../ipp/client'
import { getAttribute, getAttributes } from '../../ipp/encoding'
import type { DriverCapabilities, DriverFactory, DriverMatcher } from '../base'
import { PrinterDriver } from '../base'

export class GenericIppDriver extends PrinterDriver {
  readonly driverName = 'Generic IPP'
  protected client: IppClient

  constructor(uri: string, host: string, name: string) {
    super(uri, host, name)
    this.client = new IppClient({ uri })
  }

  capabilities(): DriverCapabilities {
    return {
      printing: true,
      scanning: false,
      firmware: false,
      maintenance: false,
      identify: true,
    }
  }

  async status(): Promise<PrinterStatus> {
    const groups = this.operationGroup()
    const response = await this.client.request(IppOperation.GetPrinterAttributes, groups)
    this.checkStatus(response)

    const attrs = getAttributes(response, IppTag.PrinterAttributes)

    return {
      name: str(attrs['printer-name']) || this.name,
      uri: str(attrs['printer-uri-supported']) || this.uri,
      state: mapPrinterState(num(attrs['printer-state'])),
      stateReasons: strArray(attrs['printer-state-reasons']),
      model: str(attrs['printer-make-and-model']) || undefined,
      location: str(attrs['printer-location']) || undefined,
      firmwareVersion: str(attrs['printer-firmware-string-version']) || undefined,
      serialNumber: str(attrs['printer-device-id']) || undefined,
      supportedFormats: strArray(attrs['document-format-supported']),
      supportedMedia: strArray(attrs['media-supported']),
      colorSupported: bool(attrs['color-supported']),
      duplexSupported: strArray(attrs['sides-supported']).length > 1,
      maxCopies: num(attrs['copies-supported']) || undefined,
      pagesPerMinute: num(attrs['pages-per-minute']) || undefined,
      pagesPerMinuteColor: num(attrs['pages-per-minute-color']) || undefined,
      markerNames: strArray(attrs['marker-names']),
      markerLevels: numArray(attrs['marker-levels']),
      markerColors: strArray(attrs['marker-colors']),
      markerTypes: strArray(attrs['marker-types']),
    }
  }

  async print(data: Buffer | Uint8Array, options?: PrintJobOptions): Promise<PrintJob> {
    const format = options?.documentFormat ?? detectFormat(data)
    const jobName = options?.jobName ?? `job-${Date.now()}`

    const operationAttrs: IppAttributeGroup = {
      tag: IppTag.OperationAttributes,
      attributes: [
        ...this.operationGroup()[0].attributes,
        { tag: IppTag.NameWithoutLanguage, name: 'requesting-user-name', value: currentUser() },
        { tag: IppTag.NameWithoutLanguage, name: 'job-name', value: jobName },
        { tag: IppTag.MimeMediaType, name: 'document-format', value: format },
      ],
    }

    const jobAttrs: IppAttributeGroup = {
      tag: IppTag.JobAttributes,
      attributes: buildJobAttributes(options),
    }

    const groups = jobAttrs.attributes.length > 0
      ? [operationAttrs, jobAttrs]
      : [operationAttrs]

    const response = await this.client.request(IppOperation.PrintJob, groups, data)
    this.checkStatus(response)

    const respAttrs = getAttributes(response, IppTag.JobAttributes)

    return {
      id: num(respAttrs['job-id']) || num(getAttribute(response, 'job-id')) || 0,
      uri: str(respAttrs['job-uri']) || str(getAttribute(response, 'job-uri')) || '',
      state: mapJobState(num(respAttrs['job-state']) || num(getAttribute(response, 'job-state'))),
      name: jobName,
    }
  }

  async printFile(filePath: string, options?: PrintJobOptions): Promise<PrintJob> {
    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      throw new Error(`File not found: ${filePath}`)
    }

    const data = Buffer.from(await file.arrayBuffer())
    const format = options?.documentFormat ?? mimeFromPath(filePath)

    return this.print(data, { ...options, documentFormat: format })
  }

  async jobs(which: 'completed' | 'not-completed' | 'all' = 'not-completed'): Promise<PrintJob[]> {
    const groups: IppAttributeGroup[] = [{
      tag: IppTag.OperationAttributes,
      attributes: [
        ...this.operationGroup()[0].attributes,
        { tag: IppTag.NameWithoutLanguage, name: 'requesting-user-name', value: currentUser() },
        { tag: IppTag.Keyword, name: 'which-jobs', value: which },
      ],
    }]

    const response = await this.client.request(IppOperation.GetJobs, groups)
    this.checkStatus(response)

    const jobs: PrintJob[] = []
    for (const group of response.groups) {
      if (group.tag !== IppTag.JobAttributes) continue
      const attrs: Record<string, IppAttributeValue> = {}
      for (const attr of group.attributes) {
        if (attr.name) attrs[attr.name] = attr.value
      }
      jobs.push({
        id: num(attrs['job-id']) || 0,
        uri: str(attrs['job-uri']) || '',
        state: mapJobState(num(attrs['job-state'])),
        name: str(attrs['job-name']) || 'unknown',
        sheets: num(attrs['job-media-sheets-completed']) || undefined,
      })
    }

    return jobs
  }

  async cancelJob(jobId: number): Promise<void> {
    const groups: IppAttributeGroup[] = [{
      tag: IppTag.OperationAttributes,
      attributes: [
        ...this.operationGroup()[0].attributes,
        { tag: IppTag.Integer, name: 'job-id', value: jobId },
        { tag: IppTag.NameWithoutLanguage, name: 'requesting-user-name', value: currentUser() },
      ],
    }]

    const response = await this.client.request(IppOperation.CancelJob, groups)
    this.checkStatus(response)
  }

  async jobStatus(jobId: number): Promise<PrintJob> {
    const groups: IppAttributeGroup[] = [{
      tag: IppTag.OperationAttributes,
      attributes: [
        ...this.operationGroup()[0].attributes,
        { tag: IppTag.Integer, name: 'job-id', value: jobId },
        { tag: IppTag.NameWithoutLanguage, name: 'requesting-user-name', value: currentUser() },
      ],
    }]

    const response = await this.client.request(IppOperation.GetJobAttributes, groups)
    this.checkStatus(response)

    const attrs = getAttributes(response, IppTag.JobAttributes)
    return {
      id: num(attrs['job-id']) || jobId,
      uri: str(attrs['job-uri']) || '',
      state: mapJobState(num(attrs['job-state'])),
      name: str(attrs['job-name']) || 'unknown',
      sheets: num(attrs['job-media-sheets-completed']) || undefined,
    }
  }

  async identify(): Promise<void> {
    const groups = this.operationGroup([
      { tag: IppTag.NameWithoutLanguage, name: 'requesting-user-name', value: currentUser() },
    ])

    try {
      const response = await this.client.request(IppOperation.IdentifyPrinter, groups)
      this.checkStatus(response)
    }
    catch {
      // Identify is optional — not all printers support it
    }
  }

  async validateJob(options?: PrintJobOptions): Promise<boolean> {
    const format = options?.documentFormat ?? 'application/pdf'
    const operationAttrs: IppAttributeGroup = {
      tag: IppTag.OperationAttributes,
      attributes: [
        ...this.operationGroup()[0].attributes,
        { tag: IppTag.NameWithoutLanguage, name: 'requesting-user-name', value: currentUser() },
        { tag: IppTag.MimeMediaType, name: 'document-format', value: format },
      ],
    }

    const jobAttrs: IppAttributeGroup = {
      tag: IppTag.JobAttributes,
      attributes: buildJobAttributes(options),
    }

    const groups = jobAttrs.attributes.length > 0 ? [operationAttrs, jobAttrs] : [operationAttrs]

    try {
      const response = await this.client.request(IppOperation.ValidateJob, groups)
      return response.statusCode < 0x0400
    }
    catch {
      return false
    }
  }

  // --- Helpers ---

  protected operationGroup(extra?: Array<{ tag: number, name: string, value: IppAttributeValue }>): IppAttributeGroup[] {
    return [{
      tag: IppTag.OperationAttributes,
      attributes: [
        { tag: IppTag.Charset, name: 'attributes-charset', value: 'utf-8' },
        { tag: IppTag.NaturalLanguage, name: 'attributes-natural-language', value: 'en' },
        { tag: IppTag.Uri, name: 'printer-uri', value: this.uri },
        ...(extra || []),
      ],
    }]
  }

  protected checkStatus(response: IppResponse): void {
    if (response.statusCode >= 0x0400) {
      const statusNames: Record<number, string> = {
        0x0400: 'bad-request',
        0x0401: 'forbidden',
        0x0402: 'not-authenticated',
        0x0403: 'not-authorized',
        0x0404: 'not-possible',
        0x0405: 'timeout',
        0x0406: 'not-found',
        0x040A: 'document-format-not-supported',
        0x040B: 'attributes-not-supported',
        0x0500: 'internal-error',
        0x0501: 'operation-not-supported',
        0x0502: 'service-unavailable',
        0x0504: 'device-error',
        0x0505: 'temporary-error',
        0x0507: 'busy',
      }
      const statusName = statusNames[response.statusCode] ?? 'unknown'
      const msg = str(getAttribute(response, 'status-message'))
      throw new Error(`IPP error 0x${response.statusCode.toString(16)}: ${statusName}${msg ? ` - ${msg}` : ''}`)
    }
  }
}

// --- Matcher & Factory ---

export const genericIppMatcher: DriverMatcher = () => true // fallback for any IPP printer

export const genericIppFactory: DriverFactory = (uri, host, name) =>
  new GenericIppDriver(uri, host, name)

// --- Shared helpers (exported for HP driver to reuse) ---

export function currentUser(): string {
  return process.env.USER || process.env.USERNAME || 'anonymous'
}

export function mapPrinterState(state: number): 'idle' | 'processing' | 'stopped' | 'unknown' {
  switch (state) {
    case 3: return 'idle'
    case 4: return 'processing'
    case 5: return 'stopped'
    default: return 'unknown'
  }
}

export function mapJobState(state: number): string {
  switch (state) {
    case 3: return 'pending'
    case 4: return 'pending-held'
    case 5: return 'processing'
    case 6: return 'processing-stopped'
    case 7: return 'canceled'
    case 8: return 'aborted'
    case 9: return 'completed'
    default: return `unknown(${state})`
  }
}

export function str(val: IppAttributeValue | undefined): string {
  if (val === undefined || val === null) return ''
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return str(val[0])
  return String(val)
}

export function num(val: IppAttributeValue | undefined): number {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return val
  if (Array.isArray(val)) return num(val[0])
  return Number(val) || 0
}

export function bool(val: IppAttributeValue | undefined): boolean {
  if (val === undefined || val === null) return false
  if (typeof val === 'boolean') return val
  if (Array.isArray(val)) return bool(val[0])
  return !!val
}

export function strArray(val: IppAttributeValue | undefined): string[] {
  if (val === undefined || val === null) return []
  if (Array.isArray(val)) return val.map(v => str(v))
  if (typeof val === 'string') return [val]
  return [String(val)]
}

export function numArray(val: IppAttributeValue | undefined): number[] {
  if (val === undefined || val === null) return []
  if (Array.isArray(val)) return val.map(v => num(v))
  if (typeof val === 'number') return [val]
  return []
}

export function buildJobAttributes(options?: PrintJobOptions): Array<{ tag: number, name: string, value: IppAttributeValue }> {
  if (!options) return []
  const attrs: Array<{ tag: number, name: string, value: IppAttributeValue }> = []

  if (options.copies && options.copies > 1)
    attrs.push({ tag: IppTag.Integer, name: 'copies', value: options.copies })
  if (options.media)
    attrs.push({ tag: IppTag.Keyword, name: 'media', value: options.media })
  if (options.orientation)
    attrs.push({ tag: IppTag.Enum, name: 'orientation-requested', value: OrientationMap[options.orientation] })
  if (options.quality)
    attrs.push({ tag: IppTag.Enum, name: 'print-quality', value: QualityMap[options.quality] })
  if (options.sides)
    attrs.push({ tag: IppTag.Keyword, name: 'sides', value: options.sides })
  if (options.colorMode)
    attrs.push({ tag: IppTag.Keyword, name: 'print-color-mode', value: options.colorMode })
  if (options.fitToPage)
    attrs.push({ tag: IppTag.Keyword, name: 'print-scaling', value: 'fit' })

  return attrs
}

export function detectFormat(data: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg'
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 2 && buf[0] === 0x25 && buf[1] === 0x21) return 'application/postscript'
  return 'application/octet-stream'
}

export function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'jpg': case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'gif': return 'image/gif'
    case 'tiff': case 'tif': return 'image/tiff'
    case 'ps': return 'application/postscript'
    case 'txt': return 'text/plain'
    case 'html': case 'htm': return 'text/html'
    default: return 'application/octet-stream'
  }
}
