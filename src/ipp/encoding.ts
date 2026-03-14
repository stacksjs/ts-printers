import type { IppAttribute, IppAttributeGroup, IppAttributeValue, IppRequest, IppResponse } from '../types'
import { IppTag, IppVersion } from '../types'

/**
 * Encode an IPP request into a binary buffer
 */
export function encodeIppRequest(request: IppRequest): Buffer {
  const version = request.version ?? IppVersion.V2_0
  const requestId = request.requestId ?? 1
  const chunks: Buffer[] = []

  // Version (2 bytes)
  const header = Buffer.alloc(8)
  header.writeUInt8(version[0], 0)
  header.writeUInt8(version[1], 1)
  // Operation ID (2 bytes)
  header.writeUInt16BE(request.operation, 2)
  // Request ID (4 bytes)
  header.writeUInt32BE(requestId, 4)
  chunks.push(header)

  // Attribute groups
  for (const group of request.groups) {
    // Group delimiter tag
    chunks.push(Buffer.from([group.tag]))

    for (const attr of group.attributes) {
      chunks.push(encodeAttribute(attr))
    }
  }

  // End-of-attributes tag
  chunks.push(Buffer.from([IppTag.EndOfAttributes]))

  // Optional document data
  if (request.data) {
    chunks.push(Buffer.from(request.data))
  }

  return Buffer.concat(chunks)
}

/**
 * Encode a single IPP attribute
 */
function encodeAttribute(attr: IppAttribute): Buffer {
  if (Array.isArray(attr.value)) {
    // Multi-valued attribute: first value has the name, subsequent values have empty name
    const chunks: Buffer[] = []
    for (let i = 0; i < attr.value.length; i++) {
      const singleAttr: IppAttribute = {
        tag: attr.tag,
        name: i === 0 ? attr.name : '',
        value: attr.value[i] as string | number | boolean | Buffer,
      }
      chunks.push(encodeSingleAttribute(singleAttr))
    }
    return Buffer.concat(chunks)
  }

  return encodeSingleAttribute(attr)
}

function encodeSingleAttribute(attr: IppAttribute): Buffer {
  const nameBytes = Buffer.from(attr.name, 'utf-8')
  const valueBytes = encodeValue(attr.tag, attr.value)

  // tag(1) + name-length(2) + name + value-length(2) + value
  const buf = Buffer.alloc(1 + 2 + nameBytes.length + 2 + valueBytes.length)
  let offset = 0

  buf.writeUInt8(attr.tag, offset)
  offset += 1
  buf.writeUInt16BE(nameBytes.length, offset)
  offset += 2
  nameBytes.copy(buf, offset)
  offset += nameBytes.length
  buf.writeUInt16BE(valueBytes.length, offset)
  offset += 2
  valueBytes.copy(buf, offset)

  return buf
}

function encodeValue(tag: number, value: IppAttributeValue): Buffer {
  if (Array.isArray(value)) {
    // Should not reach here for multi-valued (handled above)
    return encodeValue(tag, value[0])
  }

  switch (tag) {
    case IppTag.Integer:
    case IppTag.Enum: {
      const buf = Buffer.alloc(4)
      buf.writeInt32BE(value as number, 0)
      return buf
    }
    case IppTag.Boolean: {
      return Buffer.from([value ? 1 : 0])
    }
    case IppTag.RangeOfInteger: {
      // Expect a Buffer with 8 bytes (lower + upper)
      if (Buffer.isBuffer(value))
        return value
      const buf = Buffer.alloc(8)
      buf.writeInt32BE(value as number, 0)
      buf.writeInt32BE(value as number, 4)
      return buf
    }
    case IppTag.Resolution: {
      // Expect a Buffer with 9 bytes (xres + yres + units)
      if (Buffer.isBuffer(value))
        return value
      return Buffer.alloc(9)
    }
    case IppTag.DateTime: {
      if (Buffer.isBuffer(value))
        return value
      return Buffer.alloc(11)
    }
    case IppTag.NoValue:
    case IppTag.Unknown:
    case IppTag.Unsupported: {
      return Buffer.alloc(0)
    }
    default: {
      // All string-like types: textWithoutLanguage, nameWithoutLanguage, keyword, uri, charset, etc.
      if (Buffer.isBuffer(value))
        return value
      return Buffer.from(String(value), 'utf-8')
    }
  }
}

/**
 * Decode an IPP response from a binary buffer
 */
export function decodeIppResponse(data: Buffer): IppResponse {
  let offset = 0

  // Version (2 bytes)
  const versionMajor = data.readUInt8(offset)
  offset += 1
  const versionMinor = data.readUInt8(offset)
  offset += 1

  // Status code (2 bytes)
  const statusCode = data.readUInt16BE(offset)
  offset += 2

  // Request ID (4 bytes)
  const requestId = data.readUInt32BE(offset)
  offset += 4

  // Parse attribute groups
  const groups: IppAttributeGroup[] = []
  let currentGroup: IppAttributeGroup | null = null

  while (offset < data.length) {
    const tag = data.readUInt8(offset)
    offset += 1

    // End of attributes
    if (tag === IppTag.EndOfAttributes) {
      break
    }

    // Delimiter tag - start new group
    if (isDelimiterTag(tag)) {
      currentGroup = { tag, attributes: [] }
      groups.push(currentGroup)
      continue
    }

    // Attribute
    if (!currentGroup) {
      // Skip malformed data
      continue
    }

    const nameLength = data.readUInt16BE(offset)
    offset += 2
    const name = data.subarray(offset, offset + nameLength).toString('utf-8')
    offset += nameLength

    const valueLength = data.readUInt16BE(offset)
    offset += 2
    const rawValue = data.subarray(offset, offset + valueLength)
    offset += valueLength

    const value = decodeValue(tag, rawValue)

    if (nameLength === 0 && currentGroup.attributes.length > 0) {
      // Additional value for the previous attribute (multi-valued)
      const prevAttr = currentGroup.attributes[currentGroup.attributes.length - 1]
      if (Array.isArray(prevAttr.value)) {
        prevAttr.value.push(value)
      }
      else {
        prevAttr.value = [prevAttr.value, value]
      }
    }
    else {
      currentGroup.attributes.push({ tag, name, value })
    }
  }

  // Remaining data after end-of-attributes is document data
  const remainingData = offset < data.length ? data.subarray(offset) : undefined

  return {
    version: [versionMajor, versionMinor],
    statusCode,
    requestId,
    groups,
    data: remainingData ? Buffer.from(remainingData) : undefined,
  }
}

function isDelimiterTag(tag: number): boolean {
  return tag >= 0x00 && tag <= 0x0F
}

function decodeValue(tag: number, raw: Buffer): IppAttributeValue {
  switch (tag) {
    case IppTag.Integer:
    case IppTag.Enum: {
      return raw.readInt32BE(0)
    }
    case IppTag.Boolean: {
      return raw.readUInt8(0) !== 0
    }
    case IppTag.RangeOfInteger: {
      // Return as buffer for now, consumers can interpret
      return Buffer.from(raw)
    }
    case IppTag.Resolution: {
      return Buffer.from(raw)
    }
    case IppTag.DateTime: {
      return Buffer.from(raw)
    }
    case IppTag.NoValue:
    case IppTag.Unknown:
    case IppTag.Unsupported: {
      return ''
    }
    case IppTag.OctetString: {
      return Buffer.from(raw)
    }
    default: {
      // All string types
      return raw.toString('utf-8')
    }
  }
}

/**
 * Helper to get a flat map of attribute name -> value from response groups
 */
export function getAttributes(response: IppResponse, groupTag?: number): Record<string, IppAttributeValue> {
  const result: Record<string, IppAttributeValue> = {}

  for (const group of response.groups) {
    if (groupTag !== undefined && group.tag !== groupTag)
      continue

    for (const attr of group.attributes) {
      if (attr.name) {
        result[attr.name] = attr.value
      }
    }
  }

  return result
}

/**
 * Helper to get a single attribute value
 */
export function getAttribute(response: IppResponse, name: string, groupTag?: number): IppAttributeValue | undefined {
  for (const group of response.groups) {
    if (groupTag !== undefined && group.tag !== groupTag)
      continue

    for (const attr of group.attributes) {
      if (attr.name === name) {
        return attr.value
      }
    }
  }
  return undefined
}
