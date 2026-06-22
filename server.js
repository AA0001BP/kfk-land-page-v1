require("dotenv").config();

const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const port = Number(process.env.PORT || 3000);
const siteRoot = __dirname;

const smtpHost = process.env.SMTP_HOST || "smtp.hostinger.com";
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = parseBoolean(process.env.SMTP_SECURE, smtpPort === 465);
const smtpUser = process.env.SMTP_USER || "trade@kafeko.co.uk";
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || smtpUser;
const mailTo = process.env.MAIL_TO || "trade@kafeko.co.uk";
const smtpTimeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 10000);

const rateBuckets = new Map();
const rateWindowMs = 15 * 60 * 1000;
const rateMax = 5;

app.disable("x-powered-by");
app.use(setCorsHeaders);
app.use(express.json({ limit: "25kb" }));
app.use(express.urlencoded({ extended: false, limit: "25kb" }));
app.use(setSecurityHeaders);

app.options("/api/trade-enquiry", (req, res) => {
  res.sendStatus(204);
});

app.post("/api/trade-enquiry", rateLimit, async (req, res) => {
  const enquiry = normaliseEnquiry(req.body);

  if (enquiry.website) {
    return res.json({ ok: true, message: "Thank you. Your trade enquiry has been sent." });
  }

  const errors = validateEnquiry(enquiry);
  if (errors.length > 0) {
    return res.status(400).json({ ok: false, message: errors[0] });
  }

  if (!smtpPass) {
    console.error("SMTP_PASS is missing. Add the Hostinger mailbox password to the server environment.");
    return res.status(500).json({
      ok: false,
      message: "Email is not configured yet. Please email trade@kafeko.co.uk."
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      connectionTimeout: smtpTimeoutMs,
      greetingTimeout: smtpTimeoutMs,
      socketTimeout: smtpTimeoutMs,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    await transporter.sendMail({
      from: `"Kafeko Website" <${mailFrom}>`,
      to: mailTo,
      replyTo: `${enquiry.contactName} <${enquiry.email}>`,
      subject: `New Kafeko trade enquiry from ${enquiry.businessName}`,
      text: buildTextEmail(enquiry),
      html: buildHtmlEmail(enquiry)
    });

    return res.json({ ok: true, message: "Thank you. Your trade enquiry has been sent." });
  } catch (error) {
    console.error("Trade enquiry email failed:", error);
    return res.status(500).json({
      ok: false,
      message: "There was a problem sending your enquiry. Please email trade@kafeko.co.uk."
    });
  }
});

app.use(express.static(siteRoot, {
  extensions: ["html"],
  index: "index.html"
}));

app.get("*", (req, res) => {
  res.sendFile(path.join(siteRoot, "index.html"));
});

app.listen(port, () => {
  console.log(`Kafeko site listening on http://localhost:${port}`);
  console.log(`SMTP configured for ${smtpUser} via ${smtpHost}:${smtpPort} secure=${smtpSecure}`);
});

function parseBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function normaliseEnquiry(body) {
  return {
    businessName: clean(body.businessName || body["business-name"]),
    contactName: clean(body.contactName || body["contact-name"]),
    email: clean(body.email).toLowerCase(),
    phone: clean(body.phone),
    businessType: clean(body.businessType || body["business-type"]),
    website: clean(body.website)
  };
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function validateEnquiry(enquiry) {
  const errors = [];

  if (!enquiry.businessName) {
    errors.push("Please enter your business name.");
  }

  if (!enquiry.contactName) {
    errors.push("Please enter your contact name.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) {
    errors.push("Please enter a valid email address.");
  }

  if (!/^[0-9+()\s-]{7,24}$/.test(enquiry.phone)) {
    errors.push("Please enter a valid phone number.");
  }

  if (!enquiry.businessType) {
    errors.push("Please select your business type.");
  }

  return errors;
}

function buildTextEmail(enquiry) {
  return [
    "New Kafeko trade enquiry",
    "",
    `Business name: ${enquiry.businessName}`,
    `Contact name: ${enquiry.contactName}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone}`,
    `Business type: ${enquiry.businessType}`,
    "",
    "This enquiry was submitted from the Kafeko website trade account form."
  ].join("\n");
}

function buildHtmlEmail(enquiry) {
  const rows = [
    ["Business name", enquiry.businessName],
    ["Contact name", enquiry.contactName],
    ["Email", enquiry.email],
    ["Phone", enquiry.phone],
    ["Business type", enquiry.businessType]
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #17201c; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">New Kafeko trade enquiry</h1>
      <table style="border-collapse: collapse; width: 100%; max-width: 620px;">
        ${rows.map(([label, value]) => `
          <tr>
            <th style="border: 1px solid #d8d0c3; padding: 10px; text-align: left; background: #f7f3eb; width: 180px;">${escapeHtml(label)}</th>
            <td style="border: 1px solid #d8d0c3; padding: 10px;">${escapeHtml(value)}</td>
          </tr>
        `).join("")}
      </table>
      <p style="margin-top: 16px; color: #5f6861;">This enquiry was submitted from the Kafeko website trade account form.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter((timestamp) => now - timestamp < rateWindowMs);

  if (bucket.length >= rateMax) {
    return res.status(429).json({
      ok: false,
      message: "Too many enquiries sent. Please try again in a few minutes."
    });
  }

  bucket.push(now);
  rateBuckets.set(key, bucket);
  next();
}

function setSecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' https://images.unsplash.com data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'"
    ].join("; ")
  );
  next();
}

function setCorsHeaders(req, res, next) {
  const origin = req.headers.origin;
  const isLocalOrigin = origin === "null" || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");

  if (isLocalOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  }

  next();
}
