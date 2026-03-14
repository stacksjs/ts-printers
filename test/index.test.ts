import { describe, expect, test } from 'bun:test'
import { IppOperation, IppTag, IppVersion } from '../src/types'
import { decodeIppResponse, encodeIppRequest } from '../src/ipp/encoding'
import { Printer } from '../src/printer'

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
    // Check version bytes
    expect(encoded[0]).toBe(2) // major
    expect(encoded[1]).toBe(0) // minor
    // Check operation
    expect(encoded.readUInt16BE(2)).toBe(IppOperation.GetPrinterAttributes)
    // Check request ID
    expect(encoded.readUInt32BE(4)).toBe(1)
    // Check first group tag
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

    // Simulate a "response" by changing the operation bytes to a status code (0x0000 = success)
    const responseData = Buffer.from(original)
    responseData.writeUInt16BE(0x0000, 2) // status = success

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
