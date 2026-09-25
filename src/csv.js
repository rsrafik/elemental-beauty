// One CSV field: quoted when it has a comma, quote or line break in it, and
// with a leading = + - @ defused, so a name can't run as a formula when the
// file is opened in a spreadsheet. Used by every CSV the API hands out (the
// ledger export, the attendance sheets).
export function csvCell(value) {
    let text = String(value ?? '')
    if (/^[=+\-@]/.test(text)) { text = `'${text}` }
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
