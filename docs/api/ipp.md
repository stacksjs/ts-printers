# IPP Protocol

ts-printers includes a complete IPP 2.0 (Internet Printing Protocol) implementation, built from scratch with zero external dependencies.

## IppClient

Low-level IPP client for sending requests to a printer.

```ts
import { IppClient } from 'ts-printers'
import { IppOperation, IppTag } from 'ts-printers'

const client = new IppClient({
  uri: 'ipp://printer.local:631/ipp/print',
  timeout: 10000,
  version: [2, 0],  // IPP 2.0
})

const response = await client.request(
  IppOperation.GetPrinterAttributes,
  [{
    tag: IppTag.OperationAttributes,
    attributes: [
      { tag: IppTag.Charset, name: 'attributes-charset', value: 'utf-8' },
      { tag: IppTag.NaturalLanguage, name: 'attributes-natural-language', value: 'en' },
      { tag: IppTag.Uri, name: 'printer-uri', value: 'ipp://printer.local:631/ipp/print' },
    ],
  }],
)
```

## Encoding/Decoding

```ts
import { encodeIppRequest, decodeIppResponse, getAttributes, getAttribute } from 'ts-printers'

// Encode a request
const buffer = encodeIppRequest({
  version: [2, 0],
  operation: IppOperation.PrintJob,
  requestId: 1,
  groups: [/* ... */],
  data: documentBuffer,  // optional document data
})

// Decode a response
const response = decodeIppResponse(responseBuffer)
console.log(response.statusCode)
console.log(response.groups)

// Extract attributes
const attrs = getAttributes(response, IppTag.PrinterAttributes)
const name = getAttribute(response, 'printer-name')
```

## Supported Operations

| Operation | Code | Description |
|-----------|------|-------------|
| `PrintJob` | 0x0002 | Print a document |
| `ValidateJob` | 0x0004 | Validate a job without printing |
| `CreateJob` | 0x0005 | Create an empty job |
| `SendDocument` | 0x0006 | Send document to an existing job |
| `CancelJob` | 0x0008 | Cancel a job |
| `GetJobAttributes` | 0x0009 | Get attributes of a job |
| `GetJobs` | 0x000A | List jobs |
| `GetPrinterAttributes` | 0x000B | Get printer status and capabilities |
| `PausePrinter` | 0x0010 | Pause the printer |
| `ResumePrinter` | 0x0011 | Resume the printer |
| `IdentifyPrinter` | 0x003C | Identify the printer |

## Value Tags

The IPP protocol uses tagged values. Common tags:

| Tag | Type | Example |
|-----|------|---------|
| `IppTag.Integer` | 32-bit int | copies, job-id |
| `IppTag.Boolean` | true/false | color-supported |
| `IppTag.Enum` | enumerated int | print-quality, orientation |
| `IppTag.Keyword` | string keyword | media, sides |
| `IppTag.Uri` | URI string | printer-uri |
| `IppTag.Charset` | charset string | "utf-8" |
| `IppTag.NaturalLanguage` | language | "en" |
| `IppTag.MimeMediaType` | MIME type | "application/pdf" |
| `IppTag.NameWithoutLanguage` | name string | job-name |
| `IppTag.TextWithoutLanguage` | text string | status-message |

## URI Conversion

IPP URIs are converted to HTTP for transport:
- `ipp://host:631/path` -> `http://host:631/path`
- `ipps://host:443/path` -> `https://host:443/path`
