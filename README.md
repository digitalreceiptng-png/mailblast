# MailBlast

Personalised bulk email sender built with Next.js + Zoho Mail SMTP. Upload a CSV, write a template with `{{merge_tags}}`, preview every email, then send.

---

## Quick Start (Local)

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your Zoho credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init mailblast"
gh repo create mailblast --private --push
```

### 2. Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your `mailblast` GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Add environment variables (see below)
5. Click **Deploy**

### 3. Environment Variables

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `ZOHO_USER` | `you@yourdomain.com` |
| `ZOHO_PASS` | Your Zoho app password (see below) |
| `SENDER_NAME` | Your display name, e.g. `Mike Atolagbe` |
| `APP_SECRET` | Any random string to protect your endpoint |

---

## Zoho App Password Setup

Zoho requires an **App Password** for SMTP — not your regular login password.

1. Log into [accounts.zoho.com](https://accounts.zoho.com)
2. Go to **Security → App Passwords**
3. Click **Generate New Password**
4. Name it `MailBlast` → Copy the generated password
5. Paste it as `ZOHO_PASS` in your `.env.local` / Vercel env vars

> If you use Zoho Mail's free plan, ensure SMTP access is enabled under:
> Mail → Settings → Mail Accounts → SMTP

---

## CSV Format

Required column: `email`  
Recommended: `name`  
Any other columns automatically become merge tags.

Example:
```csv
name,email,company,role
Adaeze Obi,adaeze@example.com,TechLagos,CTO
Emeka Nwosu,emeka@example.com,Finreach,CEO
```

Then in your email template:
```
Hi {{name}},

I saw what you're building at {{company}} and wanted to reach out...
```

---

## Security

- Set `APP_SECRET` in your `.env` to protect the `/api/send` endpoint from public use
- Never commit `.env.local` — it's in `.gitignore`
- The app never stores emails or CSV data — everything is in-browser memory

---

## Zoho SMTP Settings (for reference)

| Setting | Value |
|---|---|
| Host | `smtp.zoho.com` |
| Port | `465` |
| Security | `SSL` |
| Auth | Your Zoho email + app password |

---

Built by Mike · PowerChat Technologies
