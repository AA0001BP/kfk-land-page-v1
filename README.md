# Kafeko Landing Page

Single-page Kafeko wholesale landing page with a Node/Express backend for trade enquiry emails.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

3. Add the Hostinger mailbox password for `trade@kafeko.co.uk`:

   ```env
   SMTP_PASS=your-private-mailbox-password
   ```

4. Start the site:

   ```bash
   npm start
   ```

The site runs on `http://localhost:3000` by default.

## Email

The trade enquiry form posts to `/api/trade-enquiry`. The backend sends the enquiry from `trade@kafeko.co.uk` to `trade@kafeko.co.uk`, with `Reply-To` set to the customer's email address.

Default SMTP values are set for Hostinger Email:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_TIMEOUT_MS=10000
SMTP_USER=trade@kafeko.co.uk
MAIL_FROM=trade@kafeko.co.uk
MAIL_TO=trade@kafeko.co.uk
```

Use `SMTP_PORT=587` and `SMTP_SECURE=false` if you need STARTTLS instead of SSL.

During local development, open the site at `http://localhost:3000` after running `npm start`. If you accidentally open `index.html` directly from the filesystem, the form will still try to submit to `http://localhost:3000/api/trade-enquiry`, so keep the local server running while testing.
