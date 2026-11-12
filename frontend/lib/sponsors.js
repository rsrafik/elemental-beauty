// What a sponsor is, for the pages: the sponsors page (/sponsors) and the
// landing page's "sponsor a batch" form. The server holds the same rules and
// is the one that counts (src/routes/sponsorRoutes.js, src/sponsors.js).

export const STATUSES = ['pending', 'contacting', 'active', 'archive']
export const STATUS_LABELS = { pending: 'pending', contacting: 'contacting', active: 'active', archive: 'archived' }

export const OFFERS = ['products', 'money', 'other']
export const OFFER_LABELS = { products: 'products', money: 'money', other: 'something else' }

export const LIMITS = { companyName: 120, contactName: 120, contactInfo: 200, offerOther: 300, details: 2000 }

// An email address, or a phone number of 7 to 15 digits
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s().-]+$/
export function isContact(value) {
	if (EMAIL.test(value)) return true
	const digits = value.replace(/\D/g, '').length
	return PHONE.test(value) && digits >= 7 && digits <= 15
}

// trimmed, and '' is nothing
export const clean = (value) => (typeof value === 'string' ? value.trim() || null : value ?? null)

// What's still missing (a sentence), or null when it's ready to send. `form`
// is the public form, which needs everything but the additional info; by hand
// an admin needs only the company.
export function missingFrom(values, { form = false } = {}) {
	const offers = values.offers ?? []
	if (!clean(values.companyName)) return form ? 'Tell us your company’s name.' : 'Give the company’s name.'
	if (form) {
		if (!clean(values.contactName)) return 'Who should we talk to?'
		const contact = clean(values.contactInfo)
		if (!contact) return 'Leave an email address or a phone number.'
		if (!isContact(contact)) return 'That contact doesn’t look like an email address or a phone number.'
		if (!offers.length) return 'Pick what you’re offering.'
	}
	if (offers.includes('other') && !clean(values.offerOther)) {
		return form ? 'Tell us what the “something else” is.' : 'Say what the “something else” is.'
	}
	return null
}

// The body the API is sent: trimmed, in OFFERS' order, "other"'s text only
// with "other"
export function requestBody(values) {
	const offers = OFFERS.filter((offer) => (values.offers ?? []).includes(offer))
	return {
		companyName: clean(values.companyName),
		contactName: clean(values.contactName),
		contactInfo: clean(values.contactInfo),
		offers,
		offerOther: offers.includes('other') ? clean(values.offerOther) : null,
		details: clean(values.details),
	}
}

// what they're offering, as words: "products, money, and a venue"
export function offerWords(sponsor) {
	return (sponsor.offers ?? []).map((offer) => (offer === 'other' ? sponsor.offerOther || OFFER_LABELS.other : OFFER_LABELS[offer]))
}
