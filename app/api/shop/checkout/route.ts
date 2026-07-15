import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatPrice, PUBLIC_WARES_CATEGORIES } from "@/lib/pos-catalog"
import {
  createXenditCustomerReference,
  createXenditPaymentSession,
  XenditApiError,
  XenditConfigurationError,
} from "@/lib/xendit"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { checkRateLimit, cleanString, isRequestBodyTooLarge, isValidEmailAddress, rateLimitHeaders, safeHeaderValue } from "@/lib/server-security"
import { getTrustedRequestOrigin } from "@/lib/request-origin"
import { calculateCeramicShipping, type ShippingQuote } from "@/lib/shop-shipping"
import { getShippingDestination } from "@/lib/shipping-destinations"

const MAX_SHOP_CHECKOUT_BODY_BYTES = 64 * 1024
const PUBLIC_CATEGORY_IDS = PUBLIC_WARES_CATEGORIES.map((category) => category.id)
const ONLINE_SHOP_NOTE = "[online-shop]"

class ShopCheckoutValidationError extends Error {}

interface CheckoutItemRequest {
  productId: string
  quantity: number
}

interface RawCheckoutItemRequest {
  productId?: unknown
  quantity?: unknown
}

function normalizeCheckoutItems(items: unknown): CheckoutItemRequest[] {
  if (!Array.isArray(items)) return []

  const quantities = new Map<string, number>()
  items.slice(0, 25).forEach((item: RawCheckoutItemRequest) => {
    const productId = String(item?.productId || "").trim()
    const quantity = Math.max(Math.round(Number(item?.quantity || 0)), 0)
    if (!productId || quantity < 1) return
    quantities.set(productId, Math.min((quantities.get(productId) || 0) + quantity, 99))
  })

  return Array.from(quantities.entries()).map(([productId, quantity]) => ({ productId, quantity }))
}

function sanitizeReference(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "shop_sale"
}

function sanitizeCustomerName(value?: string | null) {
  return (value || "BackusCustomer").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "BackusCustomer"
}

async function restoreOnlineShopInventory(saleId: string) {
  const sale = await prisma.posSale.findUnique({
    where: { id: saleId },
    include: { items: true },
  })

  if (!sale) return

  await prisma.$transaction([
    ...sale.items
      .filter((item) => item.productId)
      .map((item) =>
        prisma.posProduct.update({
          where: { id: item.productId! },
          data: {
            quantity: { increment: item.quantity },
            status: "AVAILABLE",
            showInShop: true,
          },
        })
      ),
    prisma.posSale.update({
      where: { id: saleId },
      data: { status: "CANCELLED" },
    }),
  ])
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json(
      { error: "Please sign in before continuing to checkout.", code: "SHOP_AUTH_REQUIRED" },
      { status: 401 }
    )
  }

  const rateLimit = checkRateLimit(req, { key: "shop-checkout", limit: 8, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a few minutes and try again.", code: "SHOP_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  if (isRequestBodyTooLarge(req, MAX_SHOP_CHECKOUT_BODY_BYTES)) {
    return NextResponse.json({ error: "Checkout payload is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  const items = normalizeCheckoutItems(data?.items)
  const receiptEmail = safeHeaderValue(data?.receiptEmail || session.user.email || "", 254)
  const customerName = cleanString(data?.customerName || session.user.name || "", 160)
  const notes = cleanString(data?.notes, 1000)
  const fulfillmentMethod = data?.fulfillmentMethod === "SHIPPING" ? "SHIPPING" : "PICKUP"
  const shippingCountry = cleanString(data?.shippingCountry, 2).toUpperCase()
  const shippingCity = cleanString(data?.shippingCity, 120)
  const shippingPostalCode = cleanString(data?.shippingPostalCode, 24)
  const shippingAddress = cleanString(data?.shippingAddress, 500)

  if (items.length === 0) {
    return NextResponse.json({ error: "Checkout needs at least one available item." }, { status: 400 })
  }

  if (!isValidEmailAddress(receiptEmail)) {
    return NextResponse.json({ error: "Add a valid email address before payment." }, { status: 400 })
  }

  if (fulfillmentMethod === "SHIPPING") {
    if (!getShippingDestination(shippingCountry)) {
      return NextResponse.json({ error: "Choose a supported shipping destination." }, { status: 400 })
    }
    if (!shippingCity || !shippingPostalCode || shippingAddress.length < 8) {
      return NextResponse.json({ error: "Add the complete shipping city, postal code, and address." }, { status: 400 })
    }
  }

  const paymentReference = sanitizeReference(`shop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  let createdSaleId = ""

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const snapshots = []
      const shippingProducts = []
      let subtotal = 0

      for (const item of items) {
        const product = await tx.posProduct.findUnique({ where: { id: item.productId } })
        if (
          !product ||
          product.status !== "AVAILABLE" ||
          !product.showInShop ||
          product.cafeOnly ||
          !PUBLIC_CATEGORY_IDS.includes(product.category as (typeof PUBLIC_CATEGORY_IDS)[number])
        ) {
          throw new ShopCheckoutValidationError(`${product?.name || "This piece"} is no longer available online`)
        }
        if (product.price <= 0) {
          throw new ShopCheckoutValidationError(`${product.name} needs a price before it can be sold online`)
        }
        if (product.quantity < item.quantity) {
          throw new ShopCheckoutValidationError(`Only ${product.quantity} ${product.name} available`)
        }

        const updated = await tx.posProduct.updateMany({
          where: {
            id: item.productId,
            status: "AVAILABLE",
            showInShop: true,
            cafeOnly: false,
            quantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        })

        if (updated.count !== 1) {
          throw new ShopCheckoutValidationError(`${product.name} changed while starting checkout`)
        }

        const remaining = product.quantity - item.quantity
        if (remaining === 0) {
          await tx.posProduct.update({
            where: { id: item.productId },
            data: { status: "SOLD", showInShop: false, featured: false },
          })
        }

        const lineTotal = product.price * item.quantity
        subtotal += lineTotal
        shippingProducts.push({
          id: product.id,
          name: product.name,
          category: product.category,
          quantity: item.quantity,
          weightGrams: product.weightGrams,
          lengthCm: product.lengthCm,
          widthCm: product.widthCm,
          heightCm: product.heightCm,
        })
        snapshots.push({
          productId: product.id,
          nameSnapshot: product.name,
          skuSnapshot: product.sku,
          categorySnapshot: product.category,
          unitPrice: product.price,
          quantity: item.quantity,
          subtotal: lineTotal,
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          lineTotal,
        })
      }

      const shippingQuote: ShippingQuote | null = fulfillmentMethod === "SHIPPING"
        ? calculateCeramicShipping(shippingProducts, shippingCountry)
        : null
      const shippingAmount = shippingQuote?.amount || 0
      const total = subtotal + shippingAmount

      return tx.posSale.create({
        data: {
          subtotal,
          discountTotal: 0,
          taxTotal: 0,
          shippingAmount,
          total,
          status: "PENDING_PAYMENT",
          paymentMethod: "ONLINE",
          paymentReference,
          receiptEmail,
          fulfillmentMethod,
          shippingCountry: shippingQuote?.countryCode || null,
          shippingCity: fulfillmentMethod === "SHIPPING" ? shippingCity : null,
          shippingPostalCode: fulfillmentMethod === "SHIPPING" ? shippingPostalCode : null,
          shippingAddress: fulfillmentMethod === "SHIPPING" ? shippingAddress : null,
          shippingQuote: shippingQuote ? JSON.stringify(shippingQuote) : null,
          notes: `${ONLINE_SHOP_NOTE} ${notes || "Public online shop checkout"}`,
          items: { create: snapshots },
        },
        include: { items: true },
      })
    })

    createdSaleId = sale.id
    revalidatePath("/wall-of-cups")
    const origin = getTrustedRequestOrigin(req)
    const paymentSession = await createXenditPaymentSession({
      reference_id: paymentReference,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: sale.total,
      currency: "IDR",
      country: "ID",
      description: `Backus Ceramics shop order ${sale.id} - ${formatPrice(sale.total)}`,
      allow_save_payment_method: "DISABLED",
      locale: "en",
      customer: {
        reference_id: createXenditCustomerReference(session.user.id || receiptEmail, paymentReference),
        type: "INDIVIDUAL",
        email: receiptEmail,
        individual_detail: {
          given_names: sanitizeCustomerName(customerName || session.user.name || receiptEmail),
        },
      },
      items: [
        ...sale.items.map((item) => ({
          reference_id: item.productId || item.id,
          type: "PHYSICAL_PRODUCT" as const,
          name: item.nameSnapshot,
          net_unit_amount: Math.max(item.unitPrice, 0),
          quantity: item.quantity,
          category: item.categorySnapshot,
        })),
        ...(sale.shippingAmount > 0 ? [{
          reference_id: `shipping_${sale.id}`,
          type: "FEE" as const,
          name: "Ceramic packing and shipping",
          net_unit_amount: sale.shippingAmount,
          quantity: 1,
          category: "SHIPPING",
        }] : []),
      ],
      metadata: {
        pos_sale_id: sale.id,
        pos_payment_reference: paymentReference,
        receipt_email: receiptEmail,
        checkout_channel: "online_shop",
        customer_user_id: session.user.id,
        fulfillment_method: sale.fulfillmentMethod,
        shipping_country: sale.shippingCountry || "pickup",
      },
      success_return_url: `${origin}/shop/checkout?payment=success&sale=${sale.id}`,
      cancel_return_url: `${origin}/shop/checkout?payment=cancelled&sale=${sale.id}`,
    })

    const updatedSale = await prisma.posSale.update({
      where: { id: sale.id },
      data: { paymentSessionId: paymentSession.payment_session_id },
      include: { items: true },
    })

    await recordAnalyticsEvent({
      type: "shop_payment_started",
      userId: session.user.id,
      source: "online_shop",
      value: updatedSale.total,
      currency: updatedSale.currency,
      metadata: {
        saleId: updatedSale.id,
        paymentReference,
        paymentSessionId: paymentSession.payment_session_id,
        itemCount: updatedSale.items.length,
      },
    }, req)

    return NextResponse.json({
      saleId: updatedSale.id,
      paymentReference,
      paymentSessionId: paymentSession.payment_session_id,
      paymentUrl: paymentSession.payment_link_url,
    }, { status: 201 })
  } catch (error) {
    if (createdSaleId) {
      try {
        await restoreOnlineShopInventory(createdSaleId)
        revalidatePath("/wall-of-cups")
      } catch (restoreError) {
        console.error("Could not restore online shop inventory after payment failure", { restoreError, createdSaleId })
      }
    }

    const isXenditError = error instanceof XenditApiError
    const isConfigError = error instanceof XenditConfigurationError
    const isValidationError = error instanceof ShopCheckoutValidationError
    console.error("Could not start online shop checkout", {
      error,
      xenditStatus: isXenditError ? error.status : undefined,
      xenditCode: isXenditError ? error.xenditCode : undefined,
      xenditResponseBody: isXenditError ? error.responseBody : undefined,
    })

    return NextResponse.json(
      {
        error: isConfigError
          ? "Online payment is not configured yet."
          : isValidationError && error instanceof Error
            ? error.message
            : "Checkout could not be started right now. Please try again shortly.",
        code: isConfigError ? "SHOP_PAYMENT_CONFIGURATION_MISSING" : "SHOP_PAYMENT_FAILED",
      },
      { status: isConfigError ? 503 : isValidationError ? 409 : 502 }
    )
  }
}
