import type { IppAttributeGroup, IppOperationId, IppRequest, IppResponse } from '../types'
import { IppVersion } from '../types'
import { decodeIppResponse, encodeIppRequest } from './encoding'

let requestCounter = 1

export interface IppClientOptions {
  /** Printer URI, e.g. ipp://printer.local:631/ipp/print */
  uri: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** IPP version to use */
  version?: readonly [number, number]
}

export class IppClient {
  readonly uri: string
  readonly httpUrl: string
  readonly timeout: number
  readonly version: readonly [number, number]

  constructor(options: IppClientOptions) {
    this.uri = options.uri
    this.timeout = options.timeout ?? 10000
    this.version = options.version ?? IppVersion.V2_0
    this.httpUrl = ippUriToHttp(options.uri)
  }

  /**
   * Send a raw IPP request and get the decoded response
   */
  async request(operation: IppOperationId, groups: IppAttributeGroup[], data?: Buffer | Uint8Array): Promise<IppResponse> {
    const request: IppRequest = {
      version: this.version,
      operation,
      requestId: requestCounter++,
      groups,
      data,
    }

    const encoded = encodeIppRequest(request)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(this.httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ipp',
          'Accept': 'application/ipp',
        },
        body: encoded,
        signal: controller.signal,
        // @ts-expect-error Bun supports this
        tls: {
          rejectUnauthorized: false,
        },
      })

      if (!response.ok && response.status !== 200) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
      }

      const responseBuffer = Buffer.from(await response.arrayBuffer())
      return decodeIppResponse(responseBuffer)
    }
    finally {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Convert an IPP URI to an HTTP(S) URL for fetch
 * ipp://host:631/path -> http://host:631/path
 * ipps://host:443/path -> https://host:443/path
 */
function ippUriToHttp(uri: string): string {
  if (uri.startsWith('ipps://')) {
    return uri.replace('ipps://', 'https://')
  }
  if (uri.startsWith('ipp://')) {
    return uri.replace('ipp://', 'http://')
  }
  return uri
}
