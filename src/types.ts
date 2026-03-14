// IPP Protocol Types

export interface PrintConfig {
  defaultPrinter?: string
  printers?: Record<string, PrinterEntry>
  timeout?: number
  verbose: boolean
}

export interface PrinterEntry {
  uri: string
  name?: string
  model?: string
}

// IPP Constants

export const IppVersion = {
  V1_1: [1, 1] as const,
  V2_0: [2, 0] as const,
}

export const IppOperation = {
  PrintJob: 0x0002,
  ValidateJob: 0x0004,
  CreateJob: 0x0005,
  SendDocument: 0x0006,
  CancelJob: 0x0008,
  GetJobAttributes: 0x0009,
  GetJobs: 0x000A,
  GetPrinterAttributes: 0x000B,
  PausePrinter: 0x0010,
  ResumePrinter: 0x0011,
  IdentifyPrinter: 0x003C,
} as const

export type IppOperationId = (typeof IppOperation)[keyof typeof IppOperation]

export const IppStatusCode = {
  SuccessfulOk: 0x0000,
  SuccessfulOkIgnoredOrSubstituted: 0x0001,
  SuccessfulOkConflicting: 0x0002,
  ClientErrorBadRequest: 0x0400,
  ClientErrorForbidden: 0x0401,
  ClientErrorNotAuthenticated: 0x0402,
  ClientErrorNotAuthorized: 0x0403,
  ClientErrorNotPossible: 0x0404,
  ClientErrorTimeout: 0x0405,
  ClientErrorNotFound: 0x0406,
  ClientErrorGone: 0x0407,
  ClientErrorDocumentFormatNotSupported: 0x040A,
  ClientErrorAttributesOrValuesNotSupported: 0x040B,
  ServerErrorInternalError: 0x0500,
  ServerErrorOperationNotSupported: 0x0501,
  ServerErrorServiceUnavailable: 0x0502,
  ServerErrorVersionNotSupported: 0x0503,
  ServerErrorDeviceError: 0x0504,
  ServerErrorTemporaryError: 0x0505,
  ServerErrorBusy: 0x0507,
} as const

export const IppTag = {
  // Delimiter tags
  OperationAttributes: 0x01,
  JobAttributes: 0x02,
  EndOfAttributes: 0x03,
  PrinterAttributes: 0x04,
  UnsupportedAttributes: 0x05,

  // Out-of-band value tags
  Unsupported: 0x10,
  Unknown: 0x12,
  NoValue: 0x13,

  // Integer value tags
  Integer: 0x21,
  Boolean: 0x22,
  Enum: 0x23,

  // Octet string value tags
  OctetString: 0x30,
  DateTime: 0x31,
  Resolution: 0x32,
  RangeOfInteger: 0x33,
  BegCollection: 0x34,
  TextWithLanguage: 0x35,
  NameWithLanguage: 0x36,
  EndCollection: 0x37,

  // Character string value tags
  TextWithoutLanguage: 0x41,
  NameWithoutLanguage: 0x42,
  Keyword: 0x44,
  Uri: 0x45,
  UriScheme: 0x46,
  Charset: 0x47,
  NaturalLanguage: 0x48,
  MimeMediaType: 0x49,
  MemberAttrName: 0x4A,
} as const

export type IppTagValue = (typeof IppTag)[keyof typeof IppTag]

// IPP Request/Response types

export interface IppAttribute {
  tag: number
  name: string
  value: IppAttributeValue
}

export type IppAttributeValue = string | number | boolean | Buffer | IppAttributeValue[]

export interface IppAttributeGroup {
  tag: number
  attributes: IppAttribute[]
}

export interface IppRequest {
  version?: readonly [number, number]
  operation: IppOperationId
  requestId?: number
  groups: IppAttributeGroup[]
  data?: Buffer | Uint8Array
}

export interface IppResponse {
  version: [number, number]
  statusCode: number
  requestId: number
  groups: IppAttributeGroup[]
  data?: Buffer
}

// Discovery types

export interface DiscoveredPrinter {
  name: string
  host: string
  port: number
  uri: string
  txtRecord: Record<string, string>
  model?: string
  location?: string
  protocol: 'ipp' | 'ipps'
}

// Print Job types

export interface PrintJobOptions {
  copies?: number
  media?: string
  orientation?: 'portrait' | 'landscape'
  quality?: 'draft' | 'normal' | 'high'
  sides?: 'one-sided' | 'two-sided-long-edge' | 'two-sided-short-edge'
  colorMode?: 'color' | 'monochrome'
  documentFormat?: string
  jobName?: string
  fitToPage?: boolean
}

export interface PrintJob {
  id: number
  uri: string
  state: string
  name: string
  createdAt?: string
  completedAt?: string
  sheets?: number
}

export interface PrinterStatus {
  name: string
  uri: string
  state: 'idle' | 'processing' | 'stopped' | 'unknown'
  stateReasons: string[]
  model?: string
  location?: string
  firmwareVersion?: string
  serialNumber?: string
  supportedFormats: string[]
  supportedMedia: string[]
  colorSupported: boolean
  duplexSupported: boolean
  maxCopies?: number
  pagesPerMinute?: number
  pagesPerMinuteColor?: number
  markerNames?: string[]
  markerLevels?: number[]
  markerColors?: string[]
  markerTypes?: string[]
}

// Quality mapping
export const QualityMap = {
  draft: 3,
  normal: 4,
  high: 5,
} as const

// Orientation mapping
export const OrientationMap = {
  portrait: 3,
  landscape: 4,
} as const
