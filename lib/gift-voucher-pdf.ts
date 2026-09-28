import QRCode from "qrcode"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { formatPrice } from "@/lib/pos-catalog"
import { giftVoucherQrPayload, getGiftVoucherTitle } from "@/lib/gift-vouchers"

export interface PrintableGiftVoucher {
  code: string
  token: string
  type: string
  classDays: number | null
  participants: number
  initialAmount: number
  recipientName: string | null
  message: string | null
}

function wrapText(text: string, maxCharacters: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > maxCharacters && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

export async function buildGiftVoucherPdf(voucher: PrintableGiftVoucher, origin: string) {
  const document = await PDFDocument.create()
  const page = document.addPage([842, 595])
  const heading = await document.embedFont(StandardFonts.HelveticaBold)
  const body = await document.embedFont(StandardFonts.Helvetica)
  const italic = await document.embedFont(StandardFonts.HelveticaOblique)
  const qrPng = await QRCode.toBuffer(giftVoucherQrPayload(origin, voucher.token), {
    type: "png",
    width: 420,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#1E2A24", light: "#FFFDF8" },
  })
  const qr = await document.embedPng(qrPng)

  const ink = rgb(0.12, 0.16, 0.13)
  const clay = rgb(0.67, 0.32, 0.20)
  const paper = rgb(0.99, 0.98, 0.94)
  const muted = rgb(0.42, 0.42, 0.37)

  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: paper })
  page.drawRectangle({ x: 26, y: 26, width: 790, height: 543, borderColor: clay, borderWidth: 2 })
  page.drawText("BACKUS", { x: 62, y: 504, size: 31, font: heading, color: ink })
  page.drawText("C E R A M I C S", { x: 64, y: 480, size: 12, font: body, color: ink })
  page.drawText("GIFT VOUCHER", { x: 62, y: 416, size: 18, font: heading, color: clay })

  const titleLines = wrapText(getGiftVoucherTitle(voucher), 38)
  titleLines.forEach((line, index) => {
    page.drawText(line, { x: 62, y: 370 - index * 34, size: 27, font: heading, color: ink })
  })

  const recipient = voucher.recipientName?.trim()
  if (recipient) page.drawText(`For ${recipient}`, { x: 62, y: 270, size: 17, font: italic, color: muted })

  const messageLines = wrapText(voucher.message?.trim() || "A little time with clay, made especially for you.", 55)
  messageLines.forEach((line, index) => {
    page.drawText(line, { x: 62, y: 226 - index * 22, size: 13, font: body, color: muted })
  })

  page.drawText(voucher.type === "CASH" ? formatPrice(voucher.initialAmount) : "Class package", {
    x: 62,
    y: 128,
    size: 19,
    font: heading,
    color: ink,
  })
  page.drawText(`Voucher code: ${voucher.code}`, { x: 62, y: 92, size: 12, font: heading, color: clay })
  page.drawText("Present this QR code at the Backus Ceramics POS.", { x: 62, y: 66, size: 10, font: body, color: muted })

  page.drawRectangle({ x: 574, y: 164, width: 206, height: 206, color: rgb(1, 0.995, 0.975) })
  page.drawImage(qr, { x: 586, y: 176, width: 182, height: 182 })
  page.drawText("SCAN AT THE STUDIO", { x: 600, y: 138, size: 11, font: heading, color: ink })
  page.drawText("backusceramics.com", { x: 617, y: 66, size: 10, font: body, color: muted })

  document.setTitle(getGiftVoucherTitle(voucher))
  document.setAuthor("Backus Ceramics")
  document.setSubject(`Gift voucher ${voucher.code}`)
  return document.save()
}
