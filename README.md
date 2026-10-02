# SAATH WhatsApp agent on Vercel

WhatsApp -> Twilio -> `POST /api/whatsapp` (Vercel function) -> Claude -> Twilio REST -> WhatsApp.

## Deploy
```bash
npm install
npm i -g vercel
vercel login
vercel            # first deploy (preview), accept defaults
```
Add env vars (Vercel dashboard -> Project -> Settings -> Environment Variables, or `vercel env add NAME production`):
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `PUBLIC_BASE_URL`.
Optional: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

```bash
vercel --prod     # production deploy; copy the https URL
```
Set `PUBLIC_BASE_URL` to that production URL (no trailing slash) and redeploy once (`vercel --prod`).

## Connect Twilio
Twilio Console -> Messaging -> Try it out -> Send a WhatsApp message -> Sandbox settings:
"When a message comes in" = `https://<your-project>.vercel.app/api/whatsapp`, method POST. Save.
Join the sandbox from your phone with the `join <code>` message, then send "hi".

## Check
- `GET /api/health` returns `ok`.
- Vercel dashboard -> Logs shows each webhook invocation.
- 403 in logs = signature mismatch: `PUBLIC_BASE_URL` differs from the Twilio URL (check https, domain, no trailing slash). Turn off Vercel Deployment Protection for production (Settings -> Deployment Protection) or Twilio gets a login page instead of your function.

## Notes
- `waitUntil` keeps the function alive after the 200 ack; `maxDuration` is set to 60s in `vercel.json`.
- Sandbox: each tester must join; sessions expire after 72h of inactivity.
- Test with made-up prescriptions only until consent logging and data agreements exist.
