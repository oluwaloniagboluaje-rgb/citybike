This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Customer email campaigns

Administrators can create and manage promotional emails at
`/dashboard/admin/campaigns`. The feature uses the existing MongoDB customer
and order records. Active customer accounts, including accounts created by an
administrator, are eligible by default; customers who unsubscribe are excluded.
Transactional emails continue to use the existing mailer.

Administrators can upload campaign images (JPG, PNG, GIF or WebP, up to 5 MB)
from a phone or computer. Uploads use the existing public `package-photos`
Supabase Storage bucket under `marketing-campaigns/`; that bucket must allow
the admin browser client to upload files and provide public image URLs.

Campaign sending uses Resend's batch API. Configure `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` in the hosting environment; test and bulk campaign emails
do not fall back to SMTP. Configure `NEXT_PUBLIC_APP_URL` to the canonical
HTTPS site URL.

Scheduled campaigns and subsequent recipient batches are dispatched through
Upstash QStash. Create a QStash account, then add `QSTASH_TOKEN`,
`QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` to the Vercel
project's environment variables. The signing keys are available in the QStash
console; both are required to verify incoming dispatches. Publish the app with
the production `NEXT_PUBLIC_APP_URL` set before scheduling campaigns.

QStash's Free plan supports delays up to 7 days and 1,000 messages per day.
For campaigns scheduled more than 7 days ahead (up to the existing one-year
campaign limit), select Upstash Pay-as-you-go. Its published rate is $1 per
100,000 messages, and retries and batch-continuation messages also count.
The app publishes one message per scheduled campaign and one per follow-up
batch. Check Upstash's current [QStash pricing](https://upstash.com/pricing/qstash)
and [delay limits](https://upstash.com/docs/qstash/features/delay) before
choosing a plan.

`vercel.json` keeps a once-daily Hobby-compatible call to
`/api/marketing/worker` as a recovery sweep for delayed or interrupted work.
It is not the campaign scheduler; QStash delivers scheduled campaigns at their
requested time. Set a strong `CRON_SECRET` in Vercel so the recovery endpoint
is protected.

For campaign delivery and engagement statistics, configure a Resend webhook
to `https://<your-site>/api/marketing/webhook` for delivered, bounced, failed,
opened, and clicked email events, then set the webhook signing secret as
`RESEND_WEBHOOK_SECRET`. Enable open and click tracking for the sending domain
in Resend to receive those engagement events. These settings are separate from
the existing transactional email code.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
