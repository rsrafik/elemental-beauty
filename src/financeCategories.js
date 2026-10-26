import prisma from './prismaClient.js'

// The finance categories the app itself files money under, which is why the
// treasurer can't take them off /analytics. Each says why, and the page prints
// it beside the lock.
export const LOCKED = {
    grants: 'awarded grants are filed here on their own (the grant tracker)',
    dues: 'dues marked paid on the dues card are filed here',
    fees: 'non-member prices paid at the door are filed here',
    sponsors: 'j-board’s treasury team files the sponsorships they keep here',
}

// 'Merch Sales' -> 'merch_sales': what a new category is stored as on the
// rows filed under it. Lowercase letters, digits and underscores, so it reads
// the same in the CSV export as the seeded ones do.
export function keyFor(label) {
    return label
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40)
}

// Null when `key` is a category of `type` ('income' / 'expense'), otherwise
// what to tell whoever sent it. A ledger row or a receipt filed under a
// category from the other half would count toward the wrong donut.
export async function categoryError(key, type) {
    const category = typeof key === 'string'
        ? await prisma.financeCategory.findUnique({ where: { key } })
        : null
    if (category?.type === type) { return null }

    const valid = await prisma.financeCategory.findMany({
        where: { type },
        orderBy: { position: 'asc' },
        select: { key: true }
    })
    return `category must be one of: ${valid.map((row) => row.key).join(', ')}`
}
