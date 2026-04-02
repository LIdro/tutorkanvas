TutorKanvas is a Next.js tutoring canvas with Clerk authentication, local BYOK provider setup, and AI-assisted maths workflows.

## Getting Started

First, set your environment variables:

```bash
cp .env.example .env.local
```

Fill in at least:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For real cross-device synced sessions, also set:

```bash
DATABASE_URL=postgres://...
```

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000), create or sign in to a Clerk account, then complete the in-app TutorKanvas setup.

## Persistence modes

- Without `DATABASE_URL`: profiles and sessions fall back to browser storage on the current device.
- With `DATABASE_URL`: profiles and sessions are stored server-side and scoped to the signed-in Clerk user.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
