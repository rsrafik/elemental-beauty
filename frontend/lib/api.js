// Everything the pages know about talking to the backend.
//
// One origin, always: in dev, next.config.mjs rewrites /api/* to the Express
// server on 5003; in production the static export is served by that same
// server. So every call here is same-origin and there's no base URL to
// configure and no CORS to arrange.
//
// The token is a JWT the API hands back at login. It lives in localStorage
// rather than a cookie because the frontend is a static export — there's no
// server render that could read a cookie before the page paints, so the page
// would have to ask the client for the token anyway.

const TOKEN_KEY = 'eb.token'

// localStorage throws in a few real situations (a private window with site
// data blocked, an iframe with third-party storage off), and it doesn't exist
// at all while the export is being prerendered at build time. Neither is worth
// crashing a page over — a missing token just means nobody is logged in.
export function getToken() {
	try {
		return window.localStorage.getItem(TOKEN_KEY)
	} catch {
		return null
	}
}

export function setToken(token) {
	try {
		if (token) window.localStorage.setItem(TOKEN_KEY, token)
		else window.localStorage.removeItem(TOKEN_KEY)
	} catch {
		// nothing to do — the session lasts as long as the tab instead
	}
}

// What a failed call throws. `status` is what callers switch on: 401 means the
// token is no good and the session should end, 409 means the thing they asked
// for conflicts with something that's already there, and everything else is
// worth showing the message for.
export class ApiError extends Error {
	constructor(status, message, body) {
		super(message)
		this.name = 'ApiError'
		this.status = status
		this.body = body
	}
}

// The one place a request is made. Returns the parsed body, throws ApiError on
// anything that isn't 2xx.
//
// A 401 clears the stored token on its way out: whatever the call was, the
// answer is that this token is finished, and leaving it in storage means every
// subsequent page load starts by failing the same way.
export async function api(path, { method = 'GET', body, auth = true } = {}) {
	const headers = {}
	if (body !== undefined) headers['Content-Type'] = 'application/json'

	if (auth) {
		const token = getToken()
		if (token) headers['Authorization'] = `Bearer ${token}`
	}

	let response
	try {
		response = await fetch(`/api${path}`, {
			method,
			headers,
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		})
	} catch {
		// the fetch itself never landed — the server is down, or the browser is
		// offline. Not a status code, so it needs its own shape.
		throw new ApiError(0, 'Could not reach the server. Is it running?')
	}

	// 204 and friends have nothing to parse, and an error page from a proxy
	// won't be JSON either — so parsing is best-effort and never the thing that
	// decides whether the call worked.
	let payload = null
	const text = await response.text()
	if (text) {
		try {
			payload = JSON.parse(text)
		} catch {
			payload = { message: text }
		}
	}

	if (!response.ok) {
		if (response.status === 401) setToken(null)
		throw new ApiError(
			response.status,
			payload?.message || `Request failed (${response.status})`,
			payload
		)
	}

	return payload
}

// A file the API hands back (a CSV export), saved through the browser. It can't
// be a plain link: the endpoint wants the Authorization header like everything
// else, and <a href> can't send one. So it's fetched as a blob and handed to a
// throwaway link with `download` on it; the name comes from the server's
// Content-Disposition when it sends one.
export async function download(path, fallbackName = 'download') {
	let response
	try {
		response = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
	} catch {
		throw new ApiError(0, 'Could not reach the server. Is it running?')
	}
	if (!response.ok) {
		let message = `Download failed (${response.status})`
		try { message = (await response.json()).message || message } catch {}
		if (response.status === 401) setToken(null)
		throw new ApiError(response.status, message)
	}
	const disposition = response.headers.get('Content-Disposition') ?? ''
	const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName
	const url = URL.createObjectURL(await response.blob())
	const link = document.createElement('a')
	link.href = url
	link.download = name
	document.body.appendChild(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- the calls the pages actually make -------------------------------------
//
// Grouped by the page that uses them rather than by HTTP verb, so a page can
// import one object and see everything it's allowed to do.

export const auth = {
	// `auth: false` on both: there's no token yet, and sending a stale one from
	// a previous session would only get it cleared by a 401 on the way past.
	login: (username, password) =>
		api('/auth/login', { method: 'POST', body: { username, password }, auth: false }),

	// Signing up gets an account and nothing else — role 'user', no membership.
	// The instagram handle is the one optional field on the form. There's no
	// username to send: the server takes it from the email, before the @.
	register: ({ firstName, lastName, email, password, instagram }) =>
		api('/auth/register', {
			method: 'POST',
			body: { firstName, lastName, email, password, instagram },
			auth: false,
		}),

	me: () => api('/auth/me'),

	// The two gates between an account and a membership: the emailed link,
	// and the waiver, signed with the name typed under it. Whichever lands
	// second makes them a member (the reply says `promoted`).
	signWaiver: ({ firstName, lastName }) =>
		api('/auth/waiver', { method: 'POST', body: { firstName, lastName } }),
	// No login needed — the token from the link is the proof.
	verifyEmail: (verificationToken) =>
		api('/auth/verify-email', { method: 'POST', body: { verificationToken }, auth: false }),
	resendVerification: () => api('/auth/resend-verification', { method: 'POST' }),

	forgotPassword: (email) =>
		api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),

	// /account's "delete my account" — asks for the password again
	deleteAccount: (password) => api('/auth/me', { method: 'DELETE', body: { password } }),
}

export const members = {
	list: () => api('/members'),
	me: () => api('/members/me'),
	// the dashboard's "Email All" — sent by the server to everyone who wants
	// club-wide email; the reply is { sent }
	emailAll: (message) => api('/members/email-all', { method: 'POST', body: message }),
	update: (fields) => api('/members/me', { method: 'PUT', body: fields }),
	add: (student) => api('/members', { method: 'POST', body: student }),
	remove: (id) => api(`/members/${id}`, { method: 'DELETE' }),
	setRole: (id, role) => api(`/members/${id}/role`, { method: 'PUT', body: { role } }),
	// action: instagram_repost | instagram_follow | discord_join — the server
	// decides what each is worth (src/points.js)
	awardPoints: (id, action) => api(`/members/${id}/points`, { method: 'POST', body: { action } }),
	// what's behind /account's five numbers: { points, labs, events, awards, earlier }
	history: () => api('/members/me/history'),
}

// The staff activity log (/students' "activity"): { entries, more }.
// `before` is the last id you have, for the next page.
export const activity = {
	list: ({ before, targetId, limit = 50 } = {}) => {
		const query = new URLSearchParams({ limit: String(limit) })
		if (before) query.set('before', String(before))
		if (targetId) query.set('targetId', String(targetId))
		return api(`/activity?${query}`)
	},
}

export const announcements = {
	list: (limit) => api(`/announcements${limit ? `?limit=${limit}` : ''}`),
	post: (body) => api('/announcements', { method: 'POST', body: { body } }),
	remove: (id) => api(`/announcements/${id}`, { method: 'DELETE' }),
}

export const eventCategories = {
	list: () => api('/event-categories'),
	add: (name) => api('/event-categories', { method: 'POST', body: { name } }),
	remove: (id) => api(`/event-categories/${id}`, { method: 'DELETE' }),
}

export const yearTargets = {
	list: () => api('/year-targets'),
	// One half can be sent on its own — editing the income goal must not blank
	// the budget, which is why this takes a partial rather than both figures.
	set: (schoolYear, fields) =>
		api(`/year-targets/${encodeURIComponent(schoolYear)}`, { method: 'PUT', body: fields }),
}

export const events = {
	list: (query = '') => api(`/events${query}`),
	create: (event) => api('/events', { method: 'POST', body: event }),
	update: (id, event) => api(`/events/${id}`, { method: 'PUT', body: event }),
	remove: (id) => api(`/events/${id}`, { method: 'DELETE' }),
	rsvp: (id) => api(`/events/${id}/rsvp`, { method: 'POST' }),
	unrsvp: (id) => api(`/events/${id}/rsvp`, { method: 'DELETE' }),
	get: (id) => api(`/events/${id}`),

	// Officers, on the check-in page — see src/routes/roster.js.
	roster: (id) => api(`/events/${id}/roster`),
	// action: checkin | uncheck | admit | offer | remove (with memberId) or add (with username)
	rosterAction: (id, body) => api(`/events/${id}/roster`, { method: 'POST', body }),
	checkin: (id, qrToken) => api(`/events/${id}/checkin`, { method: 'POST', body: { qrToken } }),
	// the check-in page's "email all": { subject, message } to everyone signed up
	emailAll: (id, message) => api(`/events/${id}/email-all`, { method: 'POST', body: message }),
	// the check-in page's "confirmation": everyone signed up who hasn't
	// confirmed is emailed a link to, by `deadline` (an ISO time)
	confirmAll: (id, deadline) => api(`/events/${id}/confirm-all`, { method: 'POST', body: { deadline } }),
	// a member confirming their own spot from the event's page
	confirm: (id) => api(`/events/${id}/confirm`, { method: 'POST' }),
	// the check-in page's attendance spreadsheet
	exportAttendance: (id) => download(`/events/${id}/attendance`, 'attendance.csv'),
}

// A waitlist offer's "Accept my spot" link (the /offer page) — no login, the
// token from the email is the proof.
export const offers = {
	accept: (token) => api('/offers/accept', { method: 'POST', body: { token }, auth: false }),
}

// A PDF as the whole request body, its name URL-encoded in a header — the
// lesson and prelab uploads. Fetched by hand because the body isn't JSON.
async function uploadPdf(url, file) {
	const response = await fetch(url, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${getToken()}`,
			'Content-Type': 'application/pdf',
			'X-Filename': encodeURIComponent(file.name),
		},
		body: file,
	})
	const payload = await response.json().catch(() => null)
	if (!response.ok) {
		throw new ApiError(response.status, payload?.message || `Upload failed (${response.status})`, payload)
	}
	return payload
}

export const labs = {
	list: () => api('/labs'),
	get: (id) => api(`/labs/${id}`),
	create: (lab) => api('/labs', { method: 'POST', body: lab }),
	update: (id, lab) => api(`/labs/${id}`, { method: 'PUT', body: lab }),
	remove: (id) => api(`/labs/${id}`, { method: 'DELETE' }),
	rsvp: (id) => api(`/labs/${id}/rsvp`, { method: 'POST' }),
	unrsvp: (id) => api(`/labs/${id}/rsvp`, { method: 'DELETE' }),
	// answers: { [questionId]: [optionId, ...] } — every question, every time;
	// the reply is { passed, correct, total, wrong: [questionId, ...] }
	submitQuiz: (id, answers) =>
		api(`/labs/${id}/quiz/submit`, { method: 'POST', body: { answers } }),

	// The lesson PDF as raw bytes, for the viewer. Fetched by hand rather than
	// through api() because the body is a file, not JSON.
	lesson: async (id) => {
		const response = await fetch(`/api/labs/${id}/lesson`, {
			headers: { Authorization: `Bearer ${getToken()}` },
		})
		if (!response.ok) {
			let message = `Could not load the lesson (${response.status})`
			try { message = (await response.json()).message || message } catch {}
			throw new ApiError(response.status, message)
		}
		return new Uint8Array(await response.arrayBuffer())
	},

	// Officers: the PDF goes up as the request body, its name in a header.
	uploadLesson: (id, file) => uploadPdf(`/api/labs/${id}/lesson`, file),
	removeLesson: (id) => api(`/labs/${id}/lesson`, { method: 'DELETE' }),

	// Officers, on the check-in page — see src/routes/roster.js.
	roster: (id) => api(`/labs/${id}/roster`),
	// action: checkin | uncheck | admit | offer | remove (with memberId) or add (with username)
	rosterAction: (id, body) => api(`/labs/${id}/roster`, { method: 'POST', body }),
	// `dues` answers a DUES_UNPAID reply: 'paid' (taken at the door) or 'waive'
	checkin: (id, qrToken, dues) => api(`/labs/${id}/checkin`, { method: 'POST', body: { qrToken, dues } }),
	// the check-in page's "email all": { subject, message } to everyone signed up
	emailAll: (id, message) => api(`/labs/${id}/email-all`, { method: 'POST', body: message }),
	// the check-in page's "confirmation": everyone signed up who hasn't
	// confirmed is emailed a link to, by `deadline` (an ISO time), with the
	// prelab attached (src/offers.js)
	confirmAll: (id, deadline) => api(`/labs/${id}/confirm-all`, { method: 'POST', body: { deadline } }),
	// a member confirming their own spot from the lab's page
	confirm: (id) => api(`/labs/${id}/confirm`, { method: 'POST' }),
	// the check-in page's attendance spreadsheet
	exportAttendance: (id) => download(`/labs/${id}/attendance`, 'attendance.csv'),

	// Officers: the prelab handout, same shape as the lesson below.
	uploadPrelab: (id, file) => uploadPdf(`/api/labs/${id}/prelab`, file),
	removePrelab: (id) => api(`/labs/${id}/prelab`, { method: 'DELETE' }),
	// the file itself, for "view" — a blob URL the caller revokes
	prelabUrl: async (id) => {
		const response = await fetch(`/api/labs/${id}/prelab`, {
			headers: { Authorization: `Bearer ${getToken()}` },
		})
		if (!response.ok) throw new ApiError(response.status, `Could not open the prelab (${response.status})`)
		return URL.createObjectURL(await response.blob())
	},

	// Officers, on the quiz editor. The read carries the answer key and any
	// unpublished draft; the save is the whole quiz, as a draft or published.
	quizForEdit: (id) => api(`/labs/${id}/quiz/edit`),
	saveQuiz: (id, questions, publish) =>
		api(`/labs/${id}/quiz`, { method: 'PUT', body: { questions, publish } }),
	discardQuizDraft: (id) => api(`/labs/${id}/quiz/draft`, { method: 'DELETE' }),
}

export const finances = {
	transactions: () => api('/transactions'),
	createTransaction: (row) => api('/transactions', { method: 'POST', body: row }),
	updateTransaction: (id, row) => api(`/transactions/${id}`, { method: 'PUT', body: row }),
	removeTransaction: (id) => api(`/transactions/${id}`, { method: 'DELETE' }),
	// the ledger as a spreadsheet; `from` / `to` are 'YYYY-MM-DD', both optional
	exportLedger: ({ from, to } = {}) => {
		const query = new URLSearchParams()
		if (from) query.set('from', from)
		if (to) query.set('to', to)
		return download(`/transactions/export${query.size ? `?${query}` : ''}`, 'ledger.csv')
	},

	grants: () => api('/grants'),
	createGrant: (grant) => api('/grants', { method: 'POST', body: grant }),
	updateGrant: (id, grant) => api(`/grants/${id}`, { method: 'PUT', body: grant }),
	removeGrant: (id) => api(`/grants/${id}`, { method: 'DELETE' }),

	myRequests: () => api('/reimbursements/mine'),
	allRequests: () => api('/reimbursements'),
	submitRequest: (request) => api('/reimbursements', { method: 'POST', body: request }),
	reviseRequest: (id, request) => api(`/reimbursements/${id}`, { method: 'PUT', body: request }),
	revokeRequest: (id) => api(`/reimbursements/${id}`, { method: 'DELETE' }),
	setRequestStatus: (id, status, denialExplanation) =>
		api(`/reimbursements/${id}/status`, {
			method: 'PUT',
			body: { status, denialExplanation },
		}),
}

// Dues, for the treasurer — one payment per member per school year. Marking
// someone paid writes an income row under 'dues' (src/routes/duesRoutes.js).
export const dues = {
	// { schoolYear, duesAmount, members: [{ userId, firstName, lastName, username, role, payment }] }
	list: (schoolYear) => api(`/dues?schoolYear=${encodeURIComponent(schoolYear)}`),
	// amount 0 = waived
	pay: ({ memberId, schoolYear, amount, paidOn }) =>
		api('/dues', { method: 'POST', body: { memberId, schoolYear, amount, paidOn } }),
	remove: (duesId) => api(`/dues/${duesId}`, { method: 'DELETE' }),
}
