import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  cleanString,
  escapeHtml,
  isRequestBodyTooLarge,
  isValidEmailAddress,
  rateLimitHeaders,
  safeEmailSubject,
  safeHeaderValue,
} from "@/lib/server-security"

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder")
const MAX_CONTACT_BODY_BYTES = 32 * 1024

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, { key: "contact-form", limit: 5, windowMs: 10 * 60_000 })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a few minutes and try again." },
        { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
      )
    }

    if (isRequestBodyTooLarge(req, MAX_CONTACT_BODY_BYTES)) {
      return NextResponse.json({ error: 'Message is too large' }, { status: 413 })
    }

    const { name, email, subject, message } = await req.json()
    const contactName = cleanString(name, 120)
    const contactEmail = safeHeaderValue(email, 254)
    const contactSubject = safeEmailSubject(subject, 'New Message')
    const contactMessage = cleanString(message, 5000)

    if (!contactName || !isValidEmailAddress(contactEmail) || !contactMessage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: 'backusceramics@gmail.com',
      replyTo: contactEmail,
      subject: `Contact Form: ${contactSubject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">New Contact Form Message</h2>
          <p><strong>Name:</strong> ${escapeHtml(contactName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(contactEmail)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(contactSubject || 'General Inquiry')}</p>
          <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
            <p style="margin: 0;"><strong>Message:</strong></p>
            <p style="white-space: pre-wrap; margin-top: 10px;">${escapeHtml(contactMessage, 5000)}</p>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">This message was sent from the Backus Ceramics contact form.</p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
