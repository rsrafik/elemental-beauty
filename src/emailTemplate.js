// The one layout every club email uses: a formatted (HTML) version with the
// club's name, a real button and a line saying why it arrived, plus a plain
// text copy of the same words for mail apps that don't show HTML. Sending both
// is also what makes it look like a message from someone rather than a script,
// which is half of staying out of spam.
//
// Email clients ignore stylesheets and most modern CSS, so everything here is
// tables and inline styles — the old way, because it's the way that renders
// the same in Gmail, Outlook and Apple Mail.

const CREAM = '#FFFBEB'
const ORANGE = '#FF7D45'
const INK = '#1F1F1F'
const MUTED = '#6B6B6B'
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

function escape(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// {
//   heading   the big line — "Confirm your email"
//   lines     the paragraphs above the button
//   button    { label, url }
//   after     paragraphs under the button (expiry, what happens next)
//   reason    the small print: why this landed in their inbox
// }
// -> { text, html }
export function actionEmail({ heading, lines = [], button, after = [], reason }) {
    const replies = process.env.EMAIL_REPLY_TO
        ? 'Questions? Just reply to this email and it will reach the club.'
        : null

    const text = [
        heading,
        '',
        ...lines.flatMap((line) => [line, '']),
        `${button.label}: ${button.url}`,
        '',
        ...after.flatMap((line) => [line, '']),
        ...(replies ? [replies, ''] : []),
        '—',
        'Elemental Beauty',
        reason
    ].join('\n')

    const paragraph = (line) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK};">${escape(line)}</p>`

    const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;">
<tr><td style="padding:32px 32px 8px;">
<p style="margin:0 0 20px;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${ORANGE};">Elemental Beauty</p>
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:1.3;color:${INK};">${escape(heading)}</h1>
${lines.map(paragraph).join('\n')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
<tr><td style="border-radius:999px;background:${ORANGE};">
<a href="${escape(button.url)}" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escape(button.label)}</a>
</td></tr>
</table>
<p style="margin:0 0 20px;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">If the button doesn't work, paste this into your browser:<br><a href="${escape(button.url)}" style="color:${MUTED};word-break:break-all;">${escape(button.url)}</a></p>
${after.map(paragraph).join('\n')}
${replies ? paragraph(replies) : ''}
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #EFEAD8;">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">${escape(reason)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

    return { text, html }
}
