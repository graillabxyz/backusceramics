import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  cleanString,
  escapeHtml,
  isRequestBodyTooLarge,
  isValidEmailAddress,
  rateLimitHeaders,
  safeHeaderValue,
} from "@/lib/server-security"

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder")
const MAX_SUBMIT_ORDER_BODY_BYTES = 128 * 1024
const MAX_ORDER_PIECES = 50

const PIECE_TYPE_LABELS: Record<string, string> = {
  'dinner-plate': 'Dinner Plate',
  'side-plate': 'Side Plate',
  'soup-bowl': 'Soup/Cereal Bowl',
  'pasta-bowl': 'Pasta Bowl',
  'serving-platter': 'Serving Platter',
  'serving-bowl': 'Serving Bowl',
  'espresso-cup': 'Espresso Cup',
  'coffee-mug': 'Coffee/Tea Mug',
  'tea-set': 'Tea Set (Pot + Cups)',
  'sake-cup': 'Sake/Wine Cup',
  'hanging-lamp': 'Hanging Pendant Lamp',
  'wall-lamp': 'Wall Lamp/Sconce',
  'table-lamp': 'Table Lamp',
  'small-vase': 'Small Vase (10-20cm)',
  'medium-vase': 'Medium Vase (20-35cm)',
  'large-vase': 'Large Vase (35-50cm)',
  'floor-vase': 'Floor Vase (50cm+)',
  'decorative-bowl': 'Decorative Bowl',
  'sculptural-piece': 'Sculptural Piece',
  'tiles': 'Tiles',
  'other': 'Other',
}

const GLAZE_LABELS: Record<string, string> = {
  'matte': 'Matte',
  'satin': 'Satin / Semi-matte',
  'glossy': 'Glossy',
  'textured': 'Textured',
  'unglazed': 'Unglazed / Raw',
  'speckled': 'Speckled',
  'reactive': 'Reactive Glaze',
  'open': 'Open to Suggestions',
}

const COLOR_LABELS: Record<string, string> = {
  'white-cream': 'White / Cream / Off-white',
  'earth-tones': 'Earth Tones (Browns, Tans)',
  'blues': 'Blues / Ocean Tones',
  'greens': 'Greens / Forest Tones',
  'neutrals': 'Grays / Charcoal / Black',
  'terracotta': 'Terracotta / Rust',
  'mixed': 'Mixed / Multi-color',
  'natural': 'Natural Clay (Unglazed)',
  'open': 'Open to Suggestions',
}

const TIMELINE_LABELS: Record<string, string> = {
  '1-month': 'Within 1 month',
  '1-2-months': '1–2 months',
  '2-3-months': '2–3 months',
  '3-6-months': '3–6 months',
  'flexible': 'Flexible / No rush',
  'specific': 'Specific date (see notes)',
}

const BUDGET_LABELS: Record<string, string> = {
  '3_5m-5m': '3,500,000 – 5,000,000 IDR',
  'under-2m': 'Under 2,000,000 IDR',
  '2m-5m': '2,000,000 – 5,000,000 IDR',
  '5m-10m': '5,000,000 – 10,000,000 IDR',
  '10m-20m': '10,000,000 – 20,000,000 IDR',
  '20m-50m': '20,000,000 – 50,000,000 IDR',
  '50m+': '50,000,000+ IDR',
  'discuss': 'Prefer to discuss',
}

function csvEscape(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

interface Piece {
  pieceType: string
  dimensions: string
  quantity: string
  finishing: string
  imageCount: number
}

interface Contact {
  name: string
  email: string
  phone: string
  location: string
}

interface Preferences {
  colorPreference: string
  timeline: string
  budget: string
  inspiration: string
  additionalNotes: string
  howDidYouHear: string
}

interface OrderPayload {
  contact: Contact
  pieces: Piece[]
  preferences: Preferences
}

function normalizeOrderPayload(input: Partial<OrderPayload>): OrderPayload {
  const contact = input.contact || ({} as Contact)
  const preferences = input.preferences || ({} as Preferences)
  const pieces = Array.isArray(input.pieces) ? input.pieces.slice(0, MAX_ORDER_PIECES) : []

  return {
    contact: {
      name: cleanString(contact.name, 160),
      email: safeHeaderValue(contact.email, 254),
      phone: cleanString(contact.phone, 80),
      location: cleanString(contact.location, 180),
    },
    pieces: pieces.map((piece) => ({
      pieceType: cleanString(piece.pieceType, 80),
      dimensions: cleanString(piece.dimensions, 240),
      quantity: cleanString(piece.quantity, 20),
      finishing: cleanString(piece.finishing, 80),
      imageCount: Number.isInteger(Number(piece.imageCount)) ? Math.max(Number(piece.imageCount), 0) : 0,
    })),
    preferences: {
      colorPreference: cleanString(preferences.colorPreference, 80),
      timeline: cleanString(preferences.timeline, 80),
      budget: cleanString(preferences.budget, 80),
      inspiration: cleanString(preferences.inspiration, 4000),
      additionalNotes: cleanString(preferences.additionalNotes, 4000),
      howDidYouHear: cleanString(preferences.howDidYouHear, 240),
    },
  }
}

function buildCSV(data: OrderPayload): string {
  const rows: string[][] = []

  rows.push(['Section', 'Field', 'Value'])
  rows.push(['', '', ''])

  // Contact
  rows.push(['CONTACT', 'Full Name', data.contact.name])
  rows.push(['CONTACT', 'Email', data.contact.email])
  rows.push(['CONTACT', 'Phone / WhatsApp', data.contact.phone || 'Not provided'])
  rows.push(['CONTACT', 'Location / Country', data.contact.location])
  rows.push(['', '', ''])

  // Pieces
  data.pieces.forEach((piece, i) => {
    const num = i + 1
    rows.push([`PIECE ${num}`, 'Type', PIECE_TYPE_LABELS[piece.pieceType] || piece.pieceType || 'Not specified'])
    rows.push([`PIECE ${num}`, 'Dimensions / Volume', piece.dimensions || 'Not specified'])
    rows.push([`PIECE ${num}`, 'Quantity', piece.quantity])
    rows.push([`PIECE ${num}`, 'Glaze & Finishing', GLAZE_LABELS[piece.finishing] || piece.finishing || 'Not specified'])
    rows.push([`PIECE ${num}`, 'Reference Images Uploaded', `${piece.imageCount}`])
    rows.push(['', '', ''])
  })

  // Preferences
  rows.push(['PREFERENCES', 'Color Palette', COLOR_LABELS[data.preferences.colorPreference] || data.preferences.colorPreference || 'Not specified'])
  rows.push(['PREFERENCES', 'Timeline', TIMELINE_LABELS[data.preferences.timeline] || data.preferences.timeline || 'Not specified'])
  rows.push(['PREFERENCES', 'Budget', BUDGET_LABELS[data.preferences.budget] || data.preferences.budget || 'Not specified'])
  rows.push(['PREFERENCES', 'Inspiration & References', data.preferences.inspiration || 'Not provided'])
  rows.push(['PREFERENCES', 'Additional Notes', data.preferences.additionalNotes || 'None'])
  rows.push(['PREFERENCES', 'How Did They Hear About Us', data.preferences.howDidYouHear || 'Not specified'])

  return rows.map(row => row.map(csvEscape).join(',')).join('\n')
}

function buildEmailHTML(data: OrderPayload): string {
  const pieceRows = data.pieces.map((piece, i) => `
    <tr style="background:${i % 2 === 0 ? '#fafaf9' : '#ffffff'}">
      <td style="padding:10px 14px;border-bottom:1px solid #e7e5e4;font-weight:600;color:#44403c">Piece ${i + 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e7e5e4;color:#57534e">${escapeHtml(PIECE_TYPE_LABELS[piece.pieceType] || piece.pieceType || '—')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e7e5e4;color:#57534e">${escapeHtml(piece.dimensions || '—', 240)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e7e5e4;color:#57534e;text-align:center">${escapeHtml(piece.quantity, 20)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e7e5e4;color:#57534e">${escapeHtml(GLAZE_LABELS[piece.finishing] || piece.finishing || '—')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e7e5e4;color:#57534e;text-align:center">${piece.imageCount}</td>
    </tr>
  `).join('')

  const totalPieces = data.pieces.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0)

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:Georgia,serif">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4">
    
    <!-- Header -->
    <div style="background:#1c1917;padding:32px 40px">
      <p style="margin:0 0 4px;color:#a8a29e;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif">Backus Ceramics</p>
      <h1 style="margin:0;color:#fafaf9;font-size:26px;font-weight:normal;letter-spacing:-0.5px">New Order Inquiry</h1>
      <p style="margin:8px 0 0;color:#78716c;font-size:13px;font-family:Arial,sans-serif">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <!-- Contact -->
    <div style="padding:32px 40px;border-bottom:1px solid #e7e5e4">
      <h2 style="margin:0 0 16px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#78716c;font-family:Arial,sans-serif;font-weight:600">Contact Information</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#78716c;font-family:Arial,sans-serif;font-size:13px;width:140px">Name</td><td style="padding:6px 0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px;font-weight:600">${escapeHtml(data.contact.name, 160)}</td></tr>
        <tr><td style="padding:6px 0;color:#78716c;font-family:Arial,sans-serif;font-size:13px">Email</td><td style="padding:6px 0;font-family:Arial,sans-serif;font-size:13px"><a href="mailto:${escapeHtml(data.contact.email, 254)}" style="color:#1c1917;font-weight:600">${escapeHtml(data.contact.email, 254)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#78716c;font-family:Arial,sans-serif;font-size:13px">Phone</td><td style="padding:6px 0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px;font-weight:600">${escapeHtml(data.contact.phone || 'Not provided', 80)}</td></tr>
        <tr><td style="padding:6px 0;color:#78716c;font-family:Arial,sans-serif;font-size:13px">Location</td><td style="padding:6px 0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px;font-weight:600">${escapeHtml(data.contact.location, 180)}</td></tr>
      </table>
    </div>

    <!-- Pieces -->
    <div style="padding:32px 40px;border-bottom:1px solid #e7e5e4">
      <h2 style="margin:0 0 16px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#78716c;font-family:Arial,sans-serif;font-weight:600">Order — ${data.pieces.length} line item${data.pieces.length !== 1 ? 's' : ''} · ${totalPieces} total piece${totalPieces !== 1 ? 's' : ''}</h2>
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
        <thead>
          <tr style="background:#f5f5f4">
            <th style="padding:10px 14px;text-align:left;color:#78716c;font-weight:600;border-bottom:2px solid #e7e5e4">#</th>
            <th style="padding:10px 14px;text-align:left;color:#78716c;font-weight:600;border-bottom:2px solid #e7e5e4">Type</th>
            <th style="padding:10px 14px;text-align:left;color:#78716c;font-weight:600;border-bottom:2px solid #e7e5e4">Dimensions</th>
            <th style="padding:10px 14px;text-align:center;color:#78716c;font-weight:600;border-bottom:2px solid #e7e5e4">Qty</th>
            <th style="padding:10px 14px;text-align:left;color:#78716c;font-weight:600;border-bottom:2px solid #e7e5e4">Finishing</th>
            <th style="padding:10px 14px;text-align:center;color:#78716c;font-weight:600;border-bottom:2px solid #e7e5e4">Images</th>
          </tr>
        </thead>
        <tbody>${pieceRows}</tbody>
      </table>
    </div>

    <!-- Preferences -->
    <div style="padding:32px 40px;border-bottom:1px solid #e7e5e4">
      <h2 style="margin:0 0 16px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#78716c;font-family:Arial,sans-serif;font-weight:600">Preferences</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#78716c;font-family:Arial,sans-serif;font-size:13px;width:160px">Color Palette</td><td style="padding:6px 0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px">${escapeHtml(COLOR_LABELS[data.preferences.colorPreference] || data.preferences.colorPreference || '—')}</td></tr>
        <tr><td style="padding:6px 0;color:#78716c;font-family:Arial,sans-serif;font-size:13px">Timeline</td><td style="padding:6px 0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px">${escapeHtml(TIMELINE_LABELS[data.preferences.timeline] || data.preferences.timeline || '—')}</td></tr>
        <tr><td style="padding:6px 0;color:#78716c;font-family:Arial,sans-serif;font-size:13px">Budget</td><td style="padding:6px 0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px">${escapeHtml(BUDGET_LABELS[data.preferences.budget] || data.preferences.budget || '—')}</td></tr>
      </table>
      ${data.preferences.inspiration ? `
        <div style="margin-top:16px">
          <p style="margin:0 0 6px;color:#78716c;font-family:Arial,sans-serif;font-size:13px">Inspiration & References</p>
          <p style="margin:0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;background:#fafaf9;padding:12px;border-radius:6px;border:1px solid #e7e5e4">${escapeHtml(data.preferences.inspiration, 4000)}</p>
        </div>
      ` : ''}
      ${data.preferences.additionalNotes ? `
        <div style="margin-top:16px">
          <p style="margin:0 0 6px;color:#78716c;font-family:Arial,sans-serif;font-size:13px">Additional Notes</p>
          <p style="margin:0;color:#1c1917;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;background:#fafaf9;padding:12px;border-radius:6px;border:1px solid #e7e5e4">${escapeHtml(data.preferences.additionalNotes, 4000)}</p>
        </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;background:#fafaf9">
      <p style="margin:0;color:#a8a29e;font-family:Arial,sans-serif;font-size:12px">Full order details are attached as a CSV file. Reply directly to this email to respond to the customer.</p>
    </div>

  </div>
</body>
</html>
  `
}

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, { key: "custom-order", limit: 3, windowMs: 30 * 60_000 })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many order requests. Please wait and try again." },
        { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
      )
    }

    if (isRequestBodyTooLarge(req, MAX_SUBMIT_ORDER_BODY_BYTES)) {
      return NextResponse.json({ error: 'Order request is too large' }, { status: 413 })
    }

    const rawData = await req.json()
    const data = normalizeOrderPayload(rawData)
    console.log('Received order inquiry', {
      pieceCount: Array.isArray(data.pieces) ? data.pieces.length : 0,
      hasEmail: Boolean(data.contact?.email),
    })

    if (!data.contact?.name || !isValidEmailAddress(data.contact?.email)) {
      return NextResponse.json({ error: 'Missing required contact fields' }, { status: 400 })
    }

    let csv: string
    let csvBuffer: Buffer
    try {
      csv = buildCSV(data)
      csvBuffer = Buffer.from(csv, 'utf-8')
    } catch (csvErr) {
      console.error('CSV generation error:', csvErr)
      return NextResponse.json({ error: 'Failed to generate order document' }, { status: 500 })
    }

    const timestamp = new Date().toISOString().split('T')[0]
    const safeName = data.contact.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const filename = `order-inquiry-${safeName}-${timestamp}.csv`

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      console.error('RESEND_API_KEY is not set')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    console.log('Sending email via Resend...')
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: 'backusceramics@gmail.com',
      replyTo: safeHeaderValue(data.contact.email),
      subject: `NEW ORDER INQUIRY: ${safeHeaderValue(data.contact.name, 100)}`,
      html: buildEmailHTML(data),
      attachments: [
        {
          filename,
          content: csvBuffer,
        },
      ],
    })

    if (error) {
      console.error('Resend email error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    console.log('Order inquiry sent successfully')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Submit order overall error:', err)
    return NextResponse.json({ 
      error: 'Internal server error',
    }, { status: 500 })
  }
}
