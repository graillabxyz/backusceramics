type MetadataValue = string | number | boolean

export interface XenditInvoiceItem {
  name: string
  quantity: number
  price: number
  category?: string
}

export interface XenditInvoiceCustomer {
  given_names?: string
  email?: string
  mobile_number?: string
}

export interface CreateXenditInvoiceInput {
  external_id: string
  amount: number
  description: string
  invoice_duration?: number
  should_send_email?: boolean
  customer?: XenditInvoiceCustomer
  currency?: "IDR"
  items?: XenditInvoiceItem[]
  metadata?: Record<string, MetadataValue | null | undefined>
  success_redirect_url?: string
  failure_redirect_url?: string
}

export interface XenditInvoiceResponse {
  id: string
  external_id: string
  invoice_url: string
  status?: string
}

export class XenditConfigurationError extends Error {
  public readonly code = "XENDIT_CONFIGURATION_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "XenditConfigurationError"
  }
}

export class XenditApiError extends Error {
  public readonly code = "XENDIT_API_ERROR"
  public readonly status: number
  public readonly xenditCode?: string
  public readonly responseBody?: string
  public readonly publicMessage: string

  constructor({
    status,
    message,
    xenditCode,
    responseBody,
  }: {
    status: number
    message: string
    xenditCode?: string
    responseBody?: string
  }) {
    const statusLabel = `HTTP ${status}`
    const codeLabel = xenditCode ? `, ${xenditCode}` : ""
    const publicMessage = `Xendit rejected the payment request (${statusLabel}${codeLabel}): ${message}`

    super(publicMessage)
    this.name = "XenditApiError"
    this.status = status
    this.xenditCode = xenditCode
    this.responseBody = responseBody
    this.publicMessage = publicMessage
  }
}

function getConfiguredXenditSecret() {
  const candidates = [
    { name: "XENDIT_SECRET_KEY", value: process.env.XENDIT_SECRET_KEY },
    { name: "XENDIT_KEY", value: process.env.XENDIT_KEY },
  ]

  return candidates
    .map((candidate) => ({
      name: candidate.name,
      value: candidate.value?.trim(),
    }))
    .find((candidate) => candidate.value)
}

export function getXenditSecretKey() {
  const configured = getConfiguredXenditSecret()
  if (!configured?.value) {
    throw new XenditConfigurationError("Xendit secret key is not configured. Set XENDIT_SECRET_KEY in Vercel.")
  }

  if (configured.value.startsWith("xnd_public_") || configured.value.includes("_public_")) {
    throw new XenditConfigurationError(`${configured.name} contains a public key. Use the Xendit secret API key for server invoice creation.`)
  }

  return configured.value
}

export function getXenditCallbackToken() {
  return (process.env.XENDIT_CALLBACK_TOKEN || process.env.XENDIT_WEBHOOK_TOKEN || "").trim()
}

function compactObject<T extends object>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
  ) as Partial<T>
}

function compactInvoicePayload(payload: CreateXenditInvoiceInput) {
  return compactObject({
    ...payload,
    customer: payload.customer ? compactObject(payload.customer) : undefined,
    metadata: payload.metadata ? compactObject(payload.metadata) : undefined,
  })
}

function extractXenditMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback
  const record = body as Record<string, unknown>
  const message = record.message || record.error || record.error_message
  if (typeof message === "string" && message.trim()) return message
  return fallback
}

function extractXenditCode(body: unknown) {
  if (!body || typeof body !== "object") return undefined
  const record = body as Record<string, unknown>
  const code = record.error_code || record.code
  return typeof code === "string" ? code : undefined
}

async function parseXenditResponse(response: Response) {
  const bodyText = await response.text()
  if (!bodyText) return { body: null, bodyText: "" }

  try {
    return { body: JSON.parse(bodyText), bodyText }
  } catch {
    return { body: null, bodyText }
  }
}

export async function createXenditInvoice(payload: CreateXenditInvoiceInput) {
  const secretKey = getXenditSecretKey()
  const endpoint = (process.env.XENDIT_INVOICE_ENDPOINT || "https://api.xendit.co/v2/invoices").trim()
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(compactInvoicePayload(payload)),
  })

  const { body, bodyText } = await parseXenditResponse(response)

  if (!response.ok) {
    throw new XenditApiError({
      status: response.status,
      message: extractXenditMessage(body, bodyText || "Could not start Xendit payment"),
      xenditCode: extractXenditCode(body),
      responseBody: bodyText.slice(0, 1000),
    })
  }

  const invoice = body as Partial<XenditInvoiceResponse> | null
  if (!invoice || typeof invoice.invoice_url !== "string" || !invoice.invoice_url) {
    throw new XenditApiError({
      status: response.status,
      message: "Xendit did not return an invoice_url.",
      responseBody: bodyText.slice(0, 1000),
    })
  }

  return invoice as XenditInvoiceResponse
}
