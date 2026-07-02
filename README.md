# Backus Ceramics

Production website and booking system for Backus Ceramics. The app includes the public site, class and residency checkout, customer accounts, admin tools, POS products, custom order inquiries, Supabase auth, and Xendit online payments.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS and Radix UI
- Prisma with Postgres
- Supabase Auth
- Supabase/Vercel hosting environment
- Xendit payment sessions
- Resend email

## Development

Use npm as the package manager.

```bash
npm install
npm run dev
```

Generate the Prisma client after schema changes:

```bash
npm run build
```

## Environment

Copy `.env.example` and fill in real values locally or in Vercel. Do not commit real `.env*` files.

Required production services:

- `DATABASE_URL` or one of the Postgres aliases used by `prisma.config.ts`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `XENDIT_SECRET_KEY`
- `XENDIT_CALLBACK_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Payments

All class and residency bookings require online payment through Xendit. Checkout reserves seats for 5 minutes while the payment session is active. Xendit webhooks confirm or cancel the reservation by payment reference, payment session id, or booking ids from metadata.

Configure Xendit payment-session webhooks to call:

```text
https://www.backusceramics.com/api/payments/xendit-webhook
```

The webhook must send the same `X-CALLBACK-TOKEN` value stored in `XENDIT_CALLBACK_TOKEN`.
