# Auth email templates

Branded copies of the Supabase auth emails. Supabase doesn't read these from the
repo — paste them into the dashboard whenever they change:

**Supabase Dashboard → project `skcwmbmcfyismcbuwncq` → Authentication → Emails**

| Template in dashboard | File | Subject to set |
|---|---|---|
| Reset password | `reset-password.html` | Reset your Disc Golf Arcade password |
| Confirm signup | `confirm-signup.html` | Confirm your Disc Golf Arcade account |

Templates use Supabase's Go-template variables (`{{ .ConfirmationURL }}`,
`{{ .Email }}`) — keep those intact when editing.

## Changing the From line ("Supabase Auth <noreply@mail.app.supabase.io>")

The sender name/address can only be changed by wiring custom SMTP
(Authentication → SMTP Settings). Rough steps with Resend (free tier):

1. Create a Resend account, add the `discgolfarcade.com` domain, and add the
   DNS records it asks for (DNS lives wherever the domain is managed — Vercel).
2. Create a Resend API key.
3. In Supabase → Authentication → SMTP Settings, enable custom SMTP:
   host `smtp.resend.com`, port `465`, username `resend`, password = API key,
   sender address `noreply@discgolfarcade.com`, sender name `Disc Golf Arcade`.

This also lifts the built-in mailer's ~2–4 emails/hour rate limit.
