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

	// The waiver is what turns an account into a membership now that email
	// verification is switched off.
	signWaiver: () => api('/auth/waiver', { method: 'POST' }),

	forgotPassword: (email) =>
		api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
}

export const members = {
	list: () => api('/members'),
	me: () => api('/members/me'),
	update: (fields) => api('/members/me', { method: 'PUT', body: fields }),
	add: (student) => api('/members', { method: 'POST', body: student }),
	remove: (id) => api(`/members/${id}`, { method: 'DELETE' }),
	setRole: (id, role) => api(`/members/${id}/role`, { method: 'PUT', body: { role } }),
	awardPoints: (id, action) => api(`/members/${id}/points`, { method: 'POST', body: { action } }),
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
	// action: checkin | uncheck | admit | remove (with memberId) or add (with username)
	rosterAction: (id, body) => api(`/events/${id}/roster`, { method: 'POST', body }),
	checkin: (id, qrToken) => api(`/events/${id}/checkin`, { method: 'POST', body: { qrToken } }),
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
	uploadLesson: async (id, file) => {
		const response = await fetch(`/api/labs/${id}/lesson`, {
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
	},
	removeLesson: (id) => api(`/labs/${id}/lesson`, { method: 'DELETE' }),

	// Officers, on the check-in page — see src/routes/roster.js.
	roster: (id) => api(`/labs/${id}/roster`),
	// action: checkin | uncheck | admit | remove (with memberId) or add (with username)
	rosterAction: (id, body) => api(`/labs/${id}/roster`, { method: 'POST', body }),
	checkin: (id, qrToken) => api(`/labs/${id}/checkin`, { method: 'POST', body: { qrToken } }),

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
