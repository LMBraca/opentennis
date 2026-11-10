# Admin invite by email

## Purpose and boundaries

A signed-in organization owner or admin can invite another admin using only an
email address. The recipient chooses a display name and password through a
single-use link. The account is verified and signed in as `admin` for the
inviting organization. It is never an owner account.

This is the product's only email flow. It does not enable public registration,
password reset, scorekeeper emails, entry confirmations, results, or other
messages. Scorekeepers continue to use revocable tournament-scoped links.

The Team screen is `/admin/team`. Only the `admins:invite` capability can open
it or perform invitation operations. The capability belongs to `owner` and
`admin`, not `scorekeeper` or `viewer`; it does not grant `destructive`.

## Locale and copy

The Team screen and outgoing mail use the organizer's current locale. The
accept and invalid-link pages use the public locale cookie and default to
Spanish (`es-MX`). Switching the page language is independent of the language
used by the email. All dictionary values are plain strings; interpolate
`{email}`, `{name}`, `{date}`, `{role}`, and `{action}` with `fill()`.

### Existing keys

| Key                | es-MX                                                 | en                                     |
| ------------------ | ----------------------------------------------------- | -------------------------------------- |
| `adminEyebrow`     | Administración                                        | Admin                                  |
| `email`            | Correo electrónico                                    | Email                                  |
| `yourName`         | Tu nombre completo                                    | Your full name                         |
| `password`         | Contraseña                                            | Password                               |
| `sending`          | Enviando…                                             | Sending…                               |
| `signingIn`        | Entrando…                                             | Signing in…                            |
| `cancel`           | Cancelar                                              | Cancel                                 |
| `entryNeedEmail`   | Escribe un correo electrónico válido.                 | Enter a valid email address.           |
| `entryNeedName`    | Escribe tu nombre.                                    | Enter your name.                       |
| `permissionDenied` | Tu cuenta ({role}) no puede {action}.                 | Your account ({role}) cannot {action}. |
| `askOwner`         | Si lo necesitas, pídeselo a quien administra el club. | Ask the club owner if you need to.     |
| `notFoundHome`     | Ir al inicio                                          | Go to the home page                    |

`denialInviteAdmins`: `invitar administradores` / `invite admins`.

### Team screen

| Key                 | es-MX                                                                                                                 | en                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `adminTeam`         | Equipo                                                                                                                | Team                                                                                                     |
| `adminTeamLead`     | Invita a otra persona a administrar el club. Solo necesitas su correo. Entra como administrador, no como propietario. | Invite someone to help run the club. You only need their email. They join as an admin, not as the owner. |
| `inviteAdmin`       | Enviar invitación                                                                                                     | Send invite                                                                                              |
| `inviteSent`        | Enviamos la invitación a {email}.                                                                                     | We sent the invite to {email}.                                                                           |
| `inviteEmailInUse`  | Ese correo ya tiene una cuenta. No se puede invitar de nuevo.                                                         | That email already has an account. You can’t invite it again.                                            |
| `inviteSendFailed`  | No se pudo enviar el correo. La invitación sigue pendiente; puedes pulsar Reenviar.                                   | The email could not be sent. The invite is still pending — you can try Resend.                           |
| `currentOrganizers` | Quienes ya tienen cuenta                                                                                              | People who already have an account                                                                       |
| `memberName`        | Nombre                                                                                                                | Name                                                                                                     |
| `memberRole`        | Rol                                                                                                                   | Role                                                                                                     |
| `roleOwner`         | Propietario                                                                                                           | Owner                                                                                                    |
| `roleAdmin`         | Administrador                                                                                                         | Admin                                                                                                    |
| `pendingInvites`    | Invitaciones pendientes                                                                                               | Pending invites                                                                                          |
| `inviteExpires`     | Caduca el {date}                                                                                                      | Expires {date}                                                                                           |
| `resendInvite`      | Reenviar                                                                                                              | Resend                                                                                                   |

The form contains only an email field. Existing owner/admin accounts are
read-only. Pending invitations remain listed after expiry until cancelled or
resent, and the pending section is omitted when it is empty.

### Email

| Key                   | es-MX                                                                                                  | en                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `inviteEmailSubject`  | Invitación para administrar Open Tennis                                                                | An invite to administer Open Tennis                                                                            |
| `inviteEmailBody`     | {name} te invita a administrar Open Tennis. El enlace caduca en 24 horas y solo se puede usar una vez. | {name} is inviting you to help administer Open Tennis. The link expires in 24 hours and can only be used once. |
| `inviteEmailLinkLead` | Abre este enlace para elegir tu nombre y contraseña:                                                   | Open this link to choose your name and password:                                                               |
| `inviteEmailIgnore`   | Si no esperabas este correo, puedes ignorarlo.                                                         | If you weren’t expecting this email, you can ignore it.                                                        |

Mail is plain text and sent from `EMAIL_FROM` using `RESEND_API_KEY`. The
inviter's display name is used for `{name}`; reply-to is the inviter's email.
The absolute link uses the current deployment's origin, so Preview does not
send a Production URL. Sending failures leave the pending record available
for resend. Neither the raw token nor a link is returned to the Team UI.

### Accept and invalid-link pages

| Key                     | es-MX                                                                                | en                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `acceptInviteTitle`     | Únete al equipo                                                                      | Join the team                                                              |
| `acceptInviteLead`      | Elige tu nombre y una contraseña. Tu correo ya está confirmado.                      | Choose your name and a password. Your email is already confirmed.          |
| `inviteEmailLocked`     | Este correo viene de la invitación y no se puede cambiar.                            | This email comes from the invite and can’t be changed.                     |
| `confirmPassword`       | Confirmar contraseña                                                                 | Confirm password                                                           |
| `passwordHint`          | Usa al menos 10 caracteres.                                                          | Use at least 10 characters.                                                |
| `passwordTooShort`      | La contraseña debe tener al menos 10 caracteres.                                     | The password must be at least 10 characters.                               |
| `passwordMismatch`      | Las contraseñas no coinciden.                                                        | The passwords do not match.                                                |
| `acceptInvite`          | Crear cuenta                                                                         | Create account                                                             |
| `inviteLinkInvalid`     | Enlace no válido                                                                     | Link not valid                                                             |
| `inviteLinkInvalidBody` | Este enlace de invitación ya no funciona. Pide uno nuevo a quien administra el club. | This invite link does not work any more. Ask the club admin for a new one. |

The email is displayed as text, not an editable field. The accept page has no
phone field or open signup. Empty name, short password, and mismatched or empty
confirmation are rejected. The invalid page is identical for unknown, expired,
cancelled, and consumed tokens and links home through `notFoundHome`.

## Database contract

The additive `0010` migration creates `invitations`. It must not be applied to
Production by this change.

| Column                     | Contract                                               |
| -------------------------- | ------------------------------------------------------ |
| `id`                       | Existing text `id()` primary key                       |
| `organization_id`          | Required FK to organizations, cascade on delete        |
| `email`                    | Required, trimmed and lowercased                       |
| `token_hash`               | Required unique SHA-256 hex hash                       |
| `expires_at`               | Required timestamptz, issued/resend time plus 24 hours |
| `invited_by_user_id`       | Nullable FK to users, set null on delete               |
| `cancelled_at`             | Nullable; non-null means no longer pending             |
| `consumed_at`              | Nullable; non-null means used                          |
| `created_at`, `updated_at` | Existing timestamps                                    |

There is a unique index on `token_hash`, an organization index, and a partial
unique index on `(organization_id, email)` while `consumed_at` and
`cancelled_at` are null. Expired records still count as pending. There is no
role column.

### Token and write rules

- Generate 32 cryptographically random bytes encoded as base64url. Store only
  SHA-256 of the token, following the session-token convention. Never log or
  persist the plaintext.
- Create rejects any email already present in `users`, including the inviter.
  Normalize before comparing. There is no account merge or disclosure of the
  existing account's role.
- Re-inviting a pending organization/email rotates the hash and resets expiry
  in one transaction; the prior link immediately stops working. A send failure
  leaves that row pending for a later resend.
- Cancel sets `cancelled_at`; a cancelled link cannot be accepted.
- Accept locks the invite by hash and rejects missing, cancelled, consumed, or
  expired rows without writes. In one transaction it checks the global user
  email unique constraint, inserts a verified user with an scrypt password,
  inserts an explicit `admin` membership, creates a normal 30-day session, and
  marks the invite consumed. A duplicate user or racing email insert rolls back
  all writes. The session cookie is set only after commit.

All list and mutation operations are scoped to the organization and require
`can(role, 'admins:invite')`. The database must keep `users.email` globally
unique. No change is made to the owner account or existing membership roles.

## Operations and QA

- Configure `RESEND_API_KEY` and a verified `EMAIL_FROM` address in Vercel.
  Local examples contain only blank placeholders.
- Verify `/api/health/db` reports `branch=development` before testing invites.
- The `0010` migration is committed for Database review; applying it is an
  operational step after merge readiness, not part of Preview or this change.
- Test English and Spanish Team/email/accept/invalid copy; resend, cancel,
  duplicate-user rejection, expiry, one-time use, and link rotation.
- After acceptance, confirm sign-out/sign-in works, the account is `admin`, and
  owner-only destructive actions remain unavailable.
- Do not alter tournament data, scorekeeper-link behavior, or public signup.
