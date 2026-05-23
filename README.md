# Backus Ceramics

Market Validation Platform for Backus Ceramics.

## Tech Stack
- Next.js
- Tailwind CSS
- Lucide React
- Framer Motion

## Development
This project is set up for automatic deployment to Vercel via GitHub.

## Environment Variables

- `XENDIT_SECRET_KEY` - server-side Xendit secret API key used to create hosted invoices. This must be the secret key, not the `xnd_public_...` browser key. `XENDIT_KEY` is also supported for backwards compatibility.
- `NEXT_PUBLIC_XENDIT_PUBLIC_KEY` - public Xendit key reserved for future client-side or embedded payment flows. `XENDIT_PUBLIC_KEY` is also supported for backwards compatibility. Do not use the secret key in browser code.
- `XENDIT_CALLBACK_TOKEN` - Xendit webhook verification token. Configure the invoice webhook in Xendit to call `/api/payments/xendit-webhook`.
