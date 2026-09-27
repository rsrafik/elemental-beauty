// Turns whatever was pasted into the lab editor's instructions box into steps
// and warnings: [{ kind: 'step' | 'warning', text }].
//
// A document's steps aren't its lines. A numbered step that wraps, or that has
// a line break typed into it, arrives as several lines, and taking every line
// as a step (which is what the box used to do) cuts one instruction into three
// bullets mid-sentence. So:
//
//   from a document (Google Docs, Word — anything that puts HTML on the
//   clipboard): each list item is one step, however many lines it runs to; a
//   list item nested inside another is a warning; a paragraph between list
//   items is a warning if it opens with "Caution:" or "Warning:", and its own
//   step otherwise.
//
//   from plain text: if any line starts with a list marker (1. 2) - • …), only
//   those lines start steps and the lines under each join it; with no markers
//   at all, every line is a step. Either way a "Caution:" line is a warning.
//
// A document pasted whole usually starts with its section's name — a
// paragraph before the first list item. That comes back as kind 'heading', for
// the caller to put in the section title if it's empty (or keep as a step).
//
// Returns null when there's nothing to take, so the caller can let the paste
// through untouched.

const MARKER = /^(?:[-*•◦▪●○]|\d+[.)]|[a-z][.)])\s+/i
const CAUTION = /^\[?\s*(?:caution|warning|danger)\s*[:\-–—]\s*/i

const tidy = (text) => text.replace(/\s+/g, ' ').trim()

// an element's words, with a line break inside it read as the space it stands
// for — textContent alone runs "20.0 mL<br>of" together into "mLof"
function wordsOf(el) {
	const copy = el.cloneNode(true)
	copy.querySelectorAll('br').forEach((br) => br.replaceWith(' '))
	return copy
}

// "Caution: hot" -> "hot"; a bracketed "[CAUTION: hot]" loses its bracket too
function asWarning(text) {
	const bracketed = text.startsWith('[')
	const body = text.replace(CAUTION, '')
	return tidy(bracketed ? body.replace(/\]\s*$/, '') : body)
}

function fromHtml(html) {
	const doc = new DOMParser().parseFromString(html, 'text/html')
	if (!doc.querySelector('li')) return null

	const out = []
	for (const el of doc.body.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6')) {
		// a paragraph inside a list item is that item's text, already taken
		if (el.tagName !== 'LI' && el.closest('li')) continue

		const words = wordsOf(el)
		// a list item's own words, not a nested list's
		if (el.tagName === 'LI') words.querySelectorAll('ol, ul').forEach((list) => list.remove())
		const text = tidy(words.textContent)
		if (!text) continue

		const nested = el.tagName === 'LI' && el.parentElement?.closest('li')
		if (!out.length && el.tagName !== 'LI' && !CAUTION.test(text)) {
			out.push({ kind: 'heading', text })
		} else if (nested || CAUTION.test(text)) {
			out.push({ kind: 'warning', text: asWarning(text) })
		} else {
			out.push({ kind: 'step', text: text.replace(MARKER, '') })
		}
	}
	return out.length ? out : null
}

function fromPlain(plain) {
	const lines = plain.split(/\r?\n/).map(tidy).filter(Boolean)
	if (!lines.length) return null
	const marked = lines.some((line) => MARKER.test(line))

	const out = []
	for (const line of lines) {
		if (CAUTION.test(line)) {
			out.push({ kind: 'warning', text: asWarning(line) })
		} else if (!marked || MARKER.test(line) || !out.length) {
			out.push({ kind: 'step', text: line.replace(MARKER, '') })
		} else {
			// a line with no marker of its own carries on the one above
			const last = out[out.length - 1]
			last.text = `${last.text} ${line}`
		}
	}
	return out
}

export function pastedSteps(clipboard) {
	const html = clipboard.getData('text/html')
	return (html && fromHtml(html)) || fromPlain(clipboard.getData('text/plain'))
}
