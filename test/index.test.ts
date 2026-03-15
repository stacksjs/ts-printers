import { describe, expect, test } from 'bun:test'
import { IppOperation, IppTag, IppVersion } from '../src/types'
import { decodeIppResponse, encodeIppRequest } from '../src/ipp/encoding'
import { Printer } from '../src/printer'
import { createDriverFromUri, GenericIppDriver, HpDriver } from '../src/drivers'

describe('IPP Encoding', () => {
  test('encodes a Get-Printer-Attributes request', () => {
    const encoded = encodeIppRequest({
      version: IppVersion.V2_0,
      operation: IppOperation.GetPrinterAttributes,
      requestId: 1,
      groups: [
        {
          tag: IppTag.OperationAttributes,
          attributes: [
            { tag: IppTag.Charset, name: 'attributes-charset', value: 'utf-8' },
            { tag: IppTag.NaturalLanguage, name: 'attributes-natural-language', value: 'en' },
            { tag: IppTag.Uri, name: 'printer-uri', value: 'ipp://localhost:631/ipp/print' },
          ],
        },
      ],
    })

    expect(encoded).toBeInstanceOf(Buffer)
    expect(encoded[0]).toBe(2)
    expect(encoded[1]).toBe(0)
    expect(encoded.readUInt16BE(2)).toBe(IppOperation.GetPrinterAttributes)
    expect(encoded.readUInt32BE(4)).toBe(1)
    expect(encoded[8]).toBe(IppTag.OperationAttributes)
  })

  test('encodes and decodes round-trip', () => {
    const original = encodeIppRequest({
      version: IppVersion.V2_0,
      operation: IppOperation.GetPrinterAttributes,
      requestId: 42,
      groups: [
        {
          tag: IppTag.OperationAttributes,
          attributes: [
            { tag: IppTag.Charset, name: 'attributes-charset', value: 'utf-8' },
            { tag: IppTag.NaturalLanguage, name: 'attributes-natural-language', value: 'en' },
            { tag: IppTag.Uri, name: 'printer-uri', value: 'ipp://test:631/ipp' },
          ],
        },
      ],
    })

    const responseData = Buffer.from(original)
    responseData.writeUInt16BE(0x0000, 2)

    const decoded = decodeIppResponse(responseData)
    expect(decoded.version).toEqual([2, 0])
    expect(decoded.statusCode).toBe(0x0000)
    expect(decoded.requestId).toBe(42)
    expect(decoded.groups.length).toBe(1)
    expect(decoded.groups[0].tag).toBe(IppTag.OperationAttributes)
    expect(decoded.groups[0].attributes.length).toBe(3)
    expect(decoded.groups[0].attributes[0].name).toBe('attributes-charset')
    expect(decoded.groups[0].attributes[0].value).toBe('utf-8')
  })

  test('encodes integer attributes', () => {
    const encoded = encodeIppRequest({
      version: IppVersion.V2_0,
      operation: IppOperation.PrintJob,
      requestId: 1,
      groups: [
        {
          tag: IppTag.OperationAttributes,
          attributes: [
            { tag: IppTag.Charset, name: 'attributes-charset', value: 'utf-8' },
            { tag: IppTag.NaturalLanguage, name: 'attributes-natural-language', value: 'en' },
          ],
        },
        {
          tag: IppTag.JobAttributes,
          attributes: [
            { tag: IppTag.Integer, name: 'copies', value: 3 },
            { tag: IppTag.Enum, name: 'print-quality', value: 5 },
            { tag: IppTag.Boolean, name: 'some-bool', value: true },
          ],
        },
      ],
    })

    const decoded = decodeIppResponse(Buffer.from(encoded))
    expect(decoded.groups.length).toBe(2)
    const jobAttrs = decoded.groups[1]
    expect(jobAttrs.attributes[0].name).toBe('copies')
    expect(jobAttrs.attributes[0].value).toBe(3)
    expect(jobAttrs.attributes[1].name).toBe('print-quality')
    expect(jobAttrs.attributes[1].value).toBe(5)
    expect(jobAttrs.attributes[2].name).toBe('some-bool')
    expect(jobAttrs.attributes[2].value).toBe(true)
  })

  test('handles multi-valued attributes', () => {
    const encoded = encodeIppRequest({
      version: IppVersion.V2_0,
      operation: IppOperation.GetPrinterAttributes,
      requestId: 1,
      groups: [
        {
          tag: IppTag.OperationAttributes,
          attributes: [
            { tag: IppTag.Charset, name: 'attributes-charset', value: 'utf-8' },
            { tag: IppTag.Keyword, name: 'document-format-supported', value: ['application/pdf', 'image/jpeg', 'image/png'] },
          ],
        },
      ],
    })

    const decoded = decodeIppResponse(Buffer.from(encoded))
    const attr = decoded.groups[0].attributes[1]
    expect(attr.name).toBe('document-format-supported')
    expect(Array.isArray(attr.value)).toBe(true)
    expect(attr.value).toEqual(['application/pdf', 'image/jpeg', 'image/png'])
  })
})

describe('Printer', () => {
  test('creates a Printer instance', () => {
    const printer = new Printer('ipp://test:631/ipp/print', 'Test Printer')
    expect(printer.uri).toBe('ipp://test:631/ipp/print')
    expect(printer.name).toBe('Test Printer')
  })

  test('defaults name to URI', () => {
    const printer = new Printer('ipp://test:631/ipp/print')
    expect(printer.name).toBe('ipp://test:631/ipp/print')
  })
})

describe('Driver Registry', () => {
  test('creates HP driver for HP URIs', () => {
    const driver = createDriverFromUri('ipp://HP-Printer.local:631/ipp/print', 'HP-Printer.local', 'HP Tango')
    expect(driver).toBeInstanceOf(HpDriver)
    expect(driver.driverName).toBe('HP')
  })

  test('creates generic driver for unknown URIs', () => {
    const driver = createDriverFromUri('ipp://canon-printer.local:631/ipp/print', 'canon-printer.local', 'Canon MG3620')
    expect(driver).toBeInstanceOf(GenericIppDriver)
    expect(driver.driverName).toBe('Generic IPP')
  })

  test('HP driver has firmware and maintenance capabilities', () => {
    const driver = createDriverFromUri('ipp://HP-Printer.local:631/ipp/print', 'HP-Printer.local', 'HP Tango')
    const caps = driver.capabilities()
    expect(caps.firmware).toBe(true)
    expect(caps.maintenance).toBe(true)
    expect(caps.printing).toBe(true)
    expect(caps.identify).toBe(true)
  })

  test('generic driver has no firmware or maintenance', () => {
    const driver = createDriverFromUri('ipp://other.local:631/ipp/print', 'other.local', 'Other Printer')
    const caps = driver.capabilities()
    expect(caps.firmware).toBe(false)
    expect(caps.maintenance).toBe(false)
    expect(caps.printing).toBe(true)
  })
})
