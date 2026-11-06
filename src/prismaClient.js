// Prisma 7: the generator emits TypeScript (hence the .ts import — Node runs
// it via --experimental-strip-types, see the dev script), and the client
// talks to Postgres through a driver adapter instead of a built-in engine.
import { PrismaClient } from './generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { IMAGES, imageKey, imagePath } from './images.js'
import { bump } from './changes.js'
import { bust } from './memo.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

// Everything Neon sends back is metered (public network transfer), so the
// heavy columns stay in the database unless a query asks for them by name:
//
//   lessonPdf, prelabPdf   megabytes of bytea; the routes that serve them (and
//                          the confirmation emails, which attach the prelab)
//                          select them
//   every picture          base64 in a text column (src/images.js) — served
//                          one at a time by GET /api/img/..., which selects it
//   draft, quizDraft       an officer's parked edits; only the editor reads
//                          them, and asks
//
// So listing labs, reading one, or a sweep reading a hundred link rows with
// their lab never drags a file or a photo along.
const OMIT = {
    lab: { lessonPdf: true, prelabPdf: true, image: true, draft: true, quizDraft: true },
    event: { image: true },
    user: { profilePicture: true },
    paymentMethod: { image: true },
    memberPayment: { screenshot: true },
    reimbursement: { receipt: true }
}

const base = new PrismaClient({ adapter, omit: OMIT })

// On every write that carries a picture, its fingerprint goes along with it —
// a new picture, a new address, so a browser holding the old one fetches
// again; a cleared one clears it. Done here rather than in each route so
// nothing that writes a picture can forget.
function stampKeys(data, spec) {
    if (!data || typeof data !== 'object') { return }
    for (const row of Array.isArray(data) ? data : [data]) {
        if (row && row[spec.field] !== undefined) {
            const value = typeof row[spec.field] === 'object' && row[spec.field] !== null && 'set' in row[spec.field]
                ? row[spec.field].set
                : row[spec.field]
            row[spec.key] = imageKey(value)
        }
    }
}

// What a check-in page shows lives on these; a write to one moves that
// page's version (src/changes.js). The sign-up rows and payments say which
// lab or event they're on; the rest (dues paid, a name, a role, the year's
// dues amount) could be on any page, so they move every one.
const ROSTER = {
    memberLab: [['labId', 'lab']],
    memberEvent: [['eventId', 'event']],
    memberPayment: [['labId', 'lab'], ['eventId', 'event']],
    duesPayment: [],
    member: [],
    user: [],
    yearTarget: []
}

// what src/memo.js keeps off each, cleared by any write to it
const KEPT = {
    user: ['auth:'],
    member: ['auth:'],
    yearTarget: ['years'],
    clubSettings: ['goggles'],
    paymentMethod: ['methods'],
    eventCategory: ['categories']
}

const WRITES = ['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany']

// which lab or event a write was about, off what it returned or what it was
// asked; null when there's no telling (then every page moves)
function parentsOf(keys, args, result) {
    const found = []
    const rows = [result, ...(Array.isArray(result) ? result : []), args?.where, ...(Array.isArray(args?.data) ? args.data : [args?.data, args?.create])]
    for (const row of rows) {
        if (!row || typeof row !== 'object') { continue }
        for (const [key, kindName] of keys) {
            if (typeof row[key] === 'number') { found.push([kindName, row[key]]) }
        }
    }
    return found
}

const modelOf = (name) => name.charAt(0).toLowerCase() + name.slice(1)
const PICTURES = Object.fromEntries(Object.values(IMAGES).map((spec) => [spec.model, spec]))

const query = {}
for (const model of new Set([...Object.keys(PICTURES), ...Object.keys(ROSTER), ...Object.keys(KEPT)])) {
    query[model] = {
        async $allOperations({ model: name, operation, args, query }) {
            if (!WRITES.includes(operation)) { return query(args) }
            const spec = PICTURES[modelOf(name)]
            if (spec) {
                if (operation === 'upsert') { stampKeys(args.create, spec); stampKeys(args.update, spec) } else { stampKeys(args.data, spec) }
            }
            const result = await query(args)
            for (const prefix of KEPT[modelOf(name)] ?? []) { bust(prefix) }
            const keys = ROSTER[modelOf(name)]
            if (keys) {
                const parents = keys.length ? parentsOf(keys, args, result) : []
                if (parents.length) { for (const [kindName, id] of parents) { bump(kindName, id) } } else { bump() }
            }
            return result
        }
    }
}

// the address the picture is served at (null when there isn't one) — on by
// default, and `select: { imageUrl: true }` asks for it by name. Reads only
// the id and the fingerprint, never the picture.
const result = {}
for (const [kind, spec] of Object.entries(IMAGES)) {
    result[spec.model] = {
        [spec.url]: {
            needs: { [spec.id]: true, [spec.key]: true },
            compute: (row) => imagePath(kind, row[spec.id], row[spec.key])
        }
    }
}

const prisma = base.$extends({ query, result })

export default prisma
