import { createHash } from 'node:crypto'

// Pictures are stored as data URLs in text columns (covers, avatars, QR codes,
// receipts, payment screenshots). Each one has a short fingerprint beside it —
// set on every write by the client in src/prismaClient.js — and is served on
// its own at GET /api/img/:kind/:id/:key (src/routes/imageRoutes.js). What the
// rest of the API hands out is that address, never the base64, so a list of
// fifty labs is a few kilobytes and a browser that's seen a cover once keeps it.

// kind in the URL → where the picture lives
export const IMAGES = {
    lab: { model: 'lab', id: 'labId', field: 'image', key: 'imageKey', url: 'imageUrl' },
    event: { model: 'event', id: 'eventId', field: 'image', key: 'imageKey', url: 'imageUrl' },
    user: { model: 'user', id: 'userId', field: 'profilePicture', key: 'pictureKey', url: 'pictureUrl' },
    method: { model: 'paymentMethod', id: 'methodId', field: 'image', key: 'imageKey', url: 'imageUrl' },
    // the two below are someone's own paperwork: always behind the same checks
    // as the rows they belong to, and never kept by the browser
    payment: { model: 'memberPayment', id: 'paymentId', field: 'screenshot', key: 'screenshotKey', url: 'screenshotUrl', private: true },
    receipt: { model: 'reimbursement', id: 'reimbursementId', field: 'receipt', key: 'receiptKey', url: 'receiptUrl', private: true }
}

// The same fingerprint the migration backfilled with (left(md5(x), 12)).
export function imageKey(value) {
    if (value == null || value === '') { return null }
    return createHash('md5').update(String(value), 'utf8').digest('hex').slice(0, 12)
}

export function imagePath(kind, id, key) {
    return key ? `/api/img/${kind}/${id}/${key}` : null
}

// What a page sends back for a picture it didn't touch: the address it was
// given. A save that carries it means "leave it as it is".
export function isImagePath(value) {
    return typeof value === 'string' && value.startsWith('/api/img/')
}

// A picture field off a request body: undefined (leave it alone) for nothing
// sent or the address handed out, otherwise what was sent (a data URL, or
// null to clear it).
export function readImage(value) {
    if (value === undefined || isImagePath(value)) { return undefined }
    return value
}

// data:image/png;base64,.... → { type, bytes }, or null for anything else
export function decodeDataUrl(value) {
    const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(value ?? '')
    if (!match) { return null }
    return { type: match[1], bytes: Buffer.from(match[2], 'base64') }
}

// A picture for a new row that may be another row's address — a payment sent
// again with the screenshot it had, an event copied with its cover. The
// address is resolved to the picture it names, if `allowed(kind, row)` says
// whoever's asking may have it (row has the fields in `select`); anything
// else is passed through as readImage would. Returns a data URL, null, or
// undefined.
export async function imageFrom(db, value, { kinds, select = {}, allowed = () => true }) {
    if (!isImagePath(value)) { return value }
    const [, , , kind, id, key] = value.split('/')
    const spec = IMAGES[kind]
    if (!spec || !kinds.includes(kind) || isNaN(Number(id))) { return undefined }
    const row = await db[spec.model].findUnique({
        where: { [spec.id]: Number(id) },
        select: { ...select, [spec.field]: true, [spec.key]: true }
    })
    if (!row || row[spec.key] !== key || !allowed(kind, row)) { return undefined }
    return row[spec.field]
}
