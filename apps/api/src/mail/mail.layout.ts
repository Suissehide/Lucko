// Gabarit HTML des e-mails, aux couleurs du design system « Plateau pop » (tokens recopiés : l'API
// ne dépend pas du design system). Tableaux et styles en ligne : seule mise en page fiable dans
// Gmail, Outlook et Apple Mail. Archivo n'est chargée que par les clients qui l'acceptent.

const C = {
  cream: '#FFF1D6',
  white: '#FFFFFF',
  ink: '#16130F',
  muted: '#4B4339',
  room: '#CF3A22',
  rating: '#F5B800',
}

const DISPLAY = "'Archivo Black', 'Arial Black', Impact, sans-serif"
const BODY = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** Ton de la sanction : couleur du bandeau et du texte qui s'y pose. */
const TONES = {
  danger: { bg: C.room, fg: C.white },
  warning: { bg: C.rating, fg: C.ink },
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Texte saisi (motif, pseudo) → HTML sans balise possible. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

/** Dé du logo Lucko (face 4) : jaune, points encre, ombre dure. */
const DIE_PIP = `<td style="width:7px;height:7px;background:${C.ink};border-radius:4px;font-size:0;line-height:0">&nbsp;</td>`
const DIE = `
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate">
  <tr><td style="width:34px;height:34px;background:${C.rating};border:3px solid ${C.ink};border-radius:8px;box-shadow:3px 3px 0 ${C.ink};padding:0">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px;border-collapse:separate;border-spacing:0">
      <tr>${DIE_PIP}<td style="width:8px"></td>${DIE_PIP}</tr>
      <tr><td colspan="3" style="height:8px;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr>${DIE_PIP}<td style="width:8px"></td>${DIE_PIP}</tr>
    </table>
  </td></tr>
</table>`

export type MailLayout = {
  /** Aperçu affiché après l'objet dans la boîte de réception. */
  preheader: string
  tone: keyof typeof TONES
  /** Bandeau : la décision, en capitales. */
  verdict: string
  /** Le fait à retenir, en gros (« Jusqu'au 13 octobre »). */
  headline: string
  greeting: string
  /** Paragraphes, texte brut (échappé ici). */
  paragraphs: string[]
  /** Encadré (le motif d'une sanction), texte brut. */
  quote?: { label: string; text: string }
  action?: { label: string; href: string }
  /** Ligne sous le bouton, texte brut. */
  closing?: string
  /** Pourquoi le destinataire reçoit l'e-mail, s'il n'a pas forcément de compte. */
  footer?: string
}

const p = (text: string) =>
  `<p style="margin:0 0 16px;font-family:${BODY};font-size:16px;line-height:24px;color:${C.ink}">${escapeHtml(text)}</p>`

/** E-mail complet, prêt pour nodemailer (`html`). */
export function mailHtml(mail: MailLayout) {
  const tone = TONES[mail.tone]
  const quote = mail.quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;border-collapse:separate">
        <tr><td style="background:${C.cream};border:2px solid ${C.ink};border-radius:10px;padding:14px 16px">
          <p style="margin:0 0 4px;font-family:${BODY};font-size:13px;line-height:18px;font-weight:800;color:${C.muted}">${escapeHtml(mail.quote.label)}</p>
          <p style="margin:0;font-family:${BODY};font-size:16px;line-height:24px;color:${C.ink};white-space:pre-line">${escapeHtml(mail.quote.text)}</p>
        </td></tr>
      </table>`
    : ''
  const action = mail.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:separate">
        <tr><td style="background:${C.ink};border:2px solid ${C.ink};border-radius:10px;box-shadow:3px 3px 0 ${C.rating}">
          <a href="${escapeHtml(mail.action.href)}" style="display:inline-block;padding:12px 20px;font-family:${BODY};font-size:15px;font-weight:800;color:${C.white};text-decoration:none">${escapeHtml(mail.action.label)}</a>
        </td></tr>
      </table>`
    : ''

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(mail.verdict)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;800&family=Archivo+Black&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(mail.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}">
  <tr><td align="center" style="padding:32px 16px 40px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
      <tr><td style="padding:0 0 20px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px">${DIE}</td>
          <td style="font-family:${DISPLAY};font-size:22px;letter-spacing:0.5px;text-transform:uppercase;color:${C.ink}">Lucko</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${C.white};border:3px solid ${C.ink};border-radius:16px;box-shadow:6px 6px 0 ${C.ink};overflow:hidden">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:${tone.bg};border-bottom:3px solid ${C.ink};border-radius:13px 13px 0 0;padding:18px 24px">
            <p style="margin:0;font-family:${DISPLAY};font-size:26px;line-height:30px;text-transform:uppercase;color:${tone.fg}">${escapeHtml(mail.verdict)}</p>
          </td></tr>
          <tr><td style="padding:24px 24px 8px">
            <p style="margin:0 0 20px;font-family:${DISPLAY};font-size:24px;line-height:30px;color:${C.ink}">${escapeHtml(mail.headline)}</p>
            ${p(mail.greeting)}
            ${mail.paragraphs.map(p).join('\n            ')}
            ${quote}
            ${action}
            ${mail.closing ? `<p style="margin:0 0 16px;font-family:${BODY};font-size:14px;line-height:21px;color:${C.muted}">${escapeHtml(mail.closing)}</p>` : ''}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 4px 0;font-family:${BODY};font-size:13px;line-height:19px;color:${C.muted}">
        <p style="margin:0 0 6px;font-weight:800;color:${C.ink}">L’équipe Lucko</p>
        ${escapeHtml(mail.footer ?? 'Tu reçois cet e-mail car tu as un compte Lucko. Il concerne la sécurité de ton compte : il n’est pas possible de s’en désabonner.')}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
