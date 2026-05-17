# Võluvatt Cloud Coupon Engine

A production-ready MVP for one-time QR coupon links for the **Võluvatt Magic Flying Cotton Candy Experience**.

The QR code is not the coupon itself. It is a secret claim link that points to a live Supabase database record. Redemption is checked online and atomically marked as redeemed so a reward cannot be used twice.

## Stack

- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS
- PWA: installable mobile web app
- Backend/database/auth: Supabase
- Server logic: Supabase Edge Functions
- Hosting: Cloudflare Pages or Vercel
- QR generation: `qrcode`
- QR scanning: `@zxing/browser`

## Core routes

- `/login` — owner/staff login
- `/admin` — owner/admin dashboard, coupon creation, batch creation, staff creation, cancellation, coupon list
- `/scan` — staff scanner and manual code fallback
- `/c/:token` — public customer coupon page
- `/reports` — admin-only reports and CSV export

## Security model

- The frontend only uses the Supabase anon/publishable key.
- The Supabase service role key is only used inside Edge Functions.
- Public coupon URLs contain the raw token.
- The database stores only `token_hash`, not the raw token.
- Tokens are random, long, and unguessable: example `c_9NfQ7aPz4VxL2mR8sYtK...`.
- Staff can scan/redeem only.
- Owner/admin can create/cancel/view coupons and reports.
- Public customers can only validate safe coupon information through `validate-coupon`.
- Redemption uses a Postgres atomic function: one `UPDATE ... WHERE status='issued' AND expires_at > now() RETURNING ...`.
- Offline redemption is not supported.

## Cost for MVP

Starting setup can be **$0**:

- Supabase Free project
- Cloudflare Pages Free static hosting
- No custom domain
- Open-source QR/scanner libraries

Future costs may appear if you outgrow free-tier limits, add a custom domain/email/SMS, need custom SMTP, or need high-volume logs/analytics.

## Local setup

### 1. Install requirements

- Node.js 20+
- npm 10+
- Supabase CLI
- Git

### 2. Clone or unzip

```bash
cd voluvatt-cloud-coupon-engine
npm install
cp .env.example .env.local
```

### 3. Create a Supabase project

1. Go to Supabase Dashboard.
2. Create a new project.
3. Save the project URL.
4. Save the anon/publishable key.
5. Save the service role key privately. Never put it in frontend hosting.

### 4. Configure frontend env

Edit `.env.local`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_PUBLIC_APP_URL=http://localhost:5173
```

### 5. Run SQL migration

Option A — Supabase Dashboard:

1. Open SQL Editor.
2. Paste `supabase/migrations/202605170001_initial.sql`.
3. Run it.

Option B — Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 6. Set Supabase Auth

In Supabase Dashboard:

1. Go to **Authentication > Providers**.
2. Enable **Email**.
3. For MVP/testing, you may disable email confirmations or create users manually from the Dashboard.
4. Add your frontend URLs in Auth URL settings:
   - Site URL: `http://localhost:5173` for local testing
   - Later: your production Cloudflare/Vercel URL

### 7. Create first owner user

1. In Supabase Dashboard, go to **Authentication > Users**.
2. Add a user with your owner email and password.
3. Copy the user UUID.
4. In SQL Editor, run:

```sql
insert into public.profiles (id, display_name, role, active)
values ('PASTE_AUTH_USER_UUID_HERE', 'Võluvatt Owner', 'owner', true)
on conflict (id) do update set role = 'owner', active = true;
```

After this, the owner can log in at `/login` and create staff accounts from `/admin`.

### 8. Set Edge Function secrets

From the project root:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
supabase secrets set PUBLIC_APP_URL=http://localhost:5173
```

For production, update `PUBLIC_APP_URL` to your deployed site URL:

```bash
supabase secrets set PUBLIC_APP_URL=https://your-site.pages.dev
```

### 9. Deploy Edge Functions

```bash
supabase functions deploy create-coupon
supabase functions deploy create-batch-coupons
supabase functions deploy validate-coupon
supabase functions deploy redeem-coupon
supabase functions deploy cancel-coupon
supabase functions deploy create-staff-user
supabase functions deploy deactivate-staff-user
```

This project sets `verify_jwt = false` in `supabase/config.toml` so every function can handle CORS and custom role checks consistently. Protected functions still require a valid Supabase user session and server-side role check.

### 10. Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:5173/login
```

## Deploy frontend to Cloudflare Pages

1. Push this folder to GitHub.
2. In Cloudflare Dashboard, create a Pages project from the GitHub repo.
3. Build command:

```bash
npm run build
```

4. Build output directory:

```text
dist
```

5. Add environment variables:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_PUBLIC_APP_URL=https://your-site.pages.dev
```

6. Deploy.
7. Update Supabase Auth Site URL and Redirect URLs to include the production URL.
8. Update the Edge Function secret:

```bash
supabase secrets set PUBLIC_APP_URL=https://your-site.pages.dev
```

## Deploy frontend to Vercel

1. Import the GitHub repo into Vercel.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add the same `VITE_*` environment variables.
6. Deploy.
7. Update Supabase Auth URLs and `PUBLIC_APP_URL` as above.

## Phone testing

1. Open the production URL on your phone.
2. Log in as owner.
3. Open `/admin`.
4. Create a staff user.
5. Log out, then log in as staff.
6. Open `/scan`.
7. Add the PWA to the phone home screen.
8. Allow camera permission.
9. Scan a coupon QR from another phone or printed QR.

## Create 3 sample coupons

1. Log in as owner/admin.
2. Go to `/admin`.
3. Choose **Free Small Cloud**.
4. Reason/source: **Manual**.
5. Expiration: tomorrow or later.
6. Click **Generate one coupon** three times, or set batch to `3` and click **Batch**.
7. Copy one public link and open it in another browser/device.

## Redeem test

1. Staff logs in on phone.
2. Staff opens `/scan`.
3. Customer opens `/c/:token` and shows QR.
4. Staff scans QR.
5. Scanner should show **GREEN: VALID**.
6. Staff taps **Redeem now**.
7. Scanner shows success and redeemed timestamp.
8. Scan the same QR again.
9. Scanner should show **RED: ALREADY REDEEMED** with the redeemed timestamp.

## Acceptance test checklist

- [ ] Admin logs in.
- [ ] Admin creates a Free Small Cloud coupon.
- [ ] App generates public link and QR code.
- [ ] Customer page opens from public link.
- [ ] Staff scans QR.
- [ ] Scanner shows GREEN valid state.
- [ ] Staff taps Redeem.
- [ ] Coupon becomes redeemed.
- [ ] Scanning same QR again shows RED already redeemed and displays redeemed date.
- [ ] Expired coupon shows GRAY expired.
- [ ] Cancelled coupon shows cancelled.
- [ ] Staff cannot access admin create functions.
- [ ] Public user cannot list coupons.
- [ ] Service role key is never exposed in frontend.

## GDPR/data minimization notes

- Do not require a child’s full name.
- `customer_label` is optional.
- `customer_contact` is optional.
- Do not collect birthday date in this MVP.
- If Cloud Passport is added later, prefer parent email plus child first name and birthday month only.

## Files of interest

```text
src/pages/AdminPage.tsx                  Admin dashboard
src/pages/ScanPage.tsx                   Staff scanner
src/pages/CustomerCouponPage.tsx         Public customer coupon page
src/pages/ReportsPage.tsx                Reports + CSV export
src/lib/api.ts                           Edge Function caller
src/lib/supabase.ts                      Supabase browser client
supabase/migrations/202605170001_initial.sql
supabase/functions/create-coupon/index.ts
supabase/functions/create-batch-coupons/index.ts
supabase/functions/validate-coupon/index.ts
supabase/functions/redeem-coupon/index.ts
supabase/functions/cancel-coupon/index.ts
supabase/functions/create-staff-user/index.ts
supabase/functions/deactivate-staff-user/index.ts
```

## Operational caution

Do not redeem coupons offline. The PWA caches the shell for convenience, but all validation and redemption calls are network-only. If the scanner has no internet, it will fail safely instead of allowing duplicate redemptions.
