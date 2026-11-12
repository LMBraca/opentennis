# OpenTennis: forgot my password (email reset)

Status: accepted by Lead, 2026-11-11 2:50 PM PT (America/Tijuana).

## Scope

Anyone with an OpenTennis password account (owners and admins) can reset a
forgotten password from the admin login page through a one-time emailed link.
This is the second deliberate exception to “Nothing is ever emailed” (after
the admin invite). No other new mail.

## Flow

1. `/admin/login` links to `/admin/forgot-password`.
2. The request page accepts an email address and validates it server-side. The
   form uses `noValidate` and localized errors.
3. Whether or not an account exists, the page displays the same neutral
   success state. It never reveals account existence in its UI, timing, or
   status code.
4. Only an account with a password receives a plain-text email from
   `EMAIL_FROM`, in the request page’s locale. The link expires in one hour
   and works once. Resend failures log only the HTTP status and error name.
5. `/admin/reset-password?token=…` displays the account email and accepts a
   new password and confirmation. Passwords must have at least 10 characters.
   Validation errors preserve the token and render on the reset page.
6. On success, one transaction updates the scrypt password hash, consumes the
   reset token, invalidates other reset tokens, deletes all existing sessions,
   and creates a new 30-day session. The response sets `ot_session` and sends
   the user to `/admin`.
7. Missing, malformed, expired, used, and superseded links show the same
   invalid-link page, with links to request a new link and to the home page.

## Security and data contract

- Generate a 32-byte `base64url` token and store only its SHA-256 hash using
  the shared `hashToken` helper. The raw value is used only in the emailed URL.
- Tokens expire after one hour, are single-use, and a newer request invalidates
  earlier unused tokens for the same user.
- Allow at most three reset requests per user and ten per IP hash per rolling
  hour. Throttled requests display the same neutral success state and send no
  mail. Unknown and passwordless accounts create no reset rows and send no
  mail.
- Store only the hash of the request IP. Use the first `x-forwarded-for` value
  where available.
- The additive `0011` migration creates `password_resets`, references
  `users(id)` with `ON DELETE CASCADE`, and indexes the token hash, user/time,
  and IP/time.
- `@opentennis/db` exports `createPasswordReset`, `getPasswordReset`, and
  `consumePasswordReset`. New reset creation and consumption use transactions.
- Email delivery is scheduled with `after()` so the Resend round trip does not
  affect the neutral response. Never log the token, token hash, reset URL, IP
  hash, API key, or email body.

## Copy and design

Spanish (`es-MX`) is the default; English is the translation. Use the invite
pages’ public chrome: `PageHeader`, `SiteNav`, `LanguageToggle`, `PageBody
width="measure"`, and the 34rem invite panel. Forms use `noValidate`; errors
appear in the `.error` slot with `role="alert"`.

The login link is left-aligned under the password field, body-small, clay-600,
underlined on hover, at least `--tap-aa` high, with the clay focus ring.

Request-page keys:

| Key | es-MX | en |
|---|---|---|
| `forgotPasswordLink` | ¿Olvidaste tu contraseña? | Forgot your password? |
| `forgotPasswordTitle` | Recupera tu contraseña | Reset your password |
| `forgotPasswordLead` | Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva. | Enter your account email and we’ll send you a link to choose a new password. |
| `sendResetLink` | Enviar enlace | Send link |
| `resetLinkSent` | Si existe una cuenta con {email}, te enviamos un enlace para elegir una contraseña nueva. Caduca en 1 hora. Revisa también la carpeta de spam. | If an account exists for {email}, we sent a link to choose a new password. It expires in 1 hour. Check your spam folder too. |
| `backToSignIn` | Volver a iniciar sesión | Back to sign in |
| `resetEmailSubject` | Elige una contraseña nueva para Open Tennis | Choose a new password for Open Tennis |
| `resetEmailBody` | Alguien pidió cambiar la contraseña de tu cuenta de Open Tennis. El enlace caduca en 1 hora y solo se puede usar una vez. | Someone asked to reset the password for your Open Tennis account. The link expires in 1 hour and can only be used once. |
| `resetEmailLinkLead` | Abre este enlace para elegir una contraseña nueva: | Open this link to choose a new password: |
| `resetEmailIgnore` | Si no lo pediste tú, ignora este correo. Tu contraseña no cambia. | If you didn’t ask for this, ignore this email. Your password stays the same. |

Reset-page keys:

| Key | es-MX | en |
|---|---|---|
| `resetPasswordTitle` | Elige una contraseña nueva | Choose a new password |
| `resetPasswordLead` | Al guardarla, se cerrará la sesión en todos tus dispositivos y entrarás aquí con la nueva. | When you save it, you’ll be signed out on every device and signed in here with the new one. |
| `newPassword` | Contraseña nueva | New password |
| `saveNewPassword` | Guardar contraseña | Save password |
| `resetLinkInvalidTitle` | Enlace no válido | Link not valid |
| `resetLinkInvalidBody` | Este enlace para cambiar la contraseña ya no funciona. Puede que haya caducado, que ya se haya usado o que hayas pedido uno más nuevo. | This password reset link does not work any more. It may have expired, been used already, or been replaced by a newer one. |
| `requestNewLink` | Pedir un enlace nuevo | Ask for a new link |

Reuse `email`, `confirmPassword`, `passwordHint`, `passwordTooShort`,
`passwordMismatch`, `entryNeedEmail`, `sending`, `saving`, and `notFoundHome`.
Document titles use the absolute `Page · OpenTennis` pattern, without a
doubled suffix.

The request form is replaced in the same panel by a focusable `role="status"`
success message followed by `backToSignIn`; there is no resend button. The
reset form shows the read-only email without an extra note, then the new
password, password hint, confirmation, and save button. Invalid-link actions
are ordered request-new-link, then home.

## Acceptance criteria

- Login link, request page, email, reset page, and invalid page are localized
  in Spanish and English, with Spanish as the default.
- Requesting for an account with a password sends a localized email; unknown,
  passwordless, and throttled requests show the same neutral state and send
  nothing.
- A short password or mismatch shows localized application copy, keeps the
  token, and does not redirect to an unsupported method.
- A valid reset lands signed in at `/admin`; prior sessions are revoked, the
  old password fails, and the new password works.
- Used, superseded, expired, garbage, and missing tokens all show the same
  invalid page.
- The fourth request in an hour for one user and the eleventh request from an
  IP in an hour send no email.
- No token, token hash, reset URL, or API key appears in the UI, logs, or PR.
- Regression coverage includes login, the Team page, invite flow, and an
  existing admin screen.

## Out of scope

No public signup, email verification, signed-in password change, or other new
mail. Never request a reset for `lmbdv50@gmail.com` or any production account.
Previews use Neon development only. Generate migration `0011` for review; do not
apply it to production.
