'use client'

import gsap from 'gsap'

// Text that comes apart letter by letter and blows away on a breeze.
//
// The element's own text is replaced by three layers: a screen-reader copy that
// still reads as one sentence, an invisible copy that keeps the element its
// natural size so the layout never moves, and an absolutely-positioned overlay
// holding one span per character. Only the overlay animates.
//
// Each character's box is measured with a Range over the invisible copy, which
// is what lets the spans start exactly where the text already sat — no visible
// hand-off at progress 0, and it works on text that wraps across lines.
//
//   const fly = createFlyText(el, { windAngle: 25 })
//   fly.progress(0.4)   // scrubbed from wherever the scroll happens to be
//
// The timeline is paused and owns no ScrollTrigger of its own: the caller
// decides what drives it. That's deliberate here, because the sequence's own
// scrub has to stay the single source of truth for where in the scroll we are.

const DEFAULTS = {
	windAngle: 25, // degrees, 0 = right, 90 = up
	windStrength: 400, // px travelled along the wind
	scatter: 80, // px of random deviation off the wind line
	maxRotation: 360, // degrees, per axis
	depth: 120, // px of Z travel
	stagger: 0.5, // 0–1, spread of per-letter start times
	order: 'random', // 'random' | 'ltr' | 'rtl' | 'outward'
	randomness: 0, // 0 = strictly ordered, 1 = fully random within the stagger
	easing: 'power3.in',
	seed: 42
}

// Deterministic RNG (splitmix32). A resize re-measures and rebuilds the whole
// timeline, and with Math.random every rebuild would deal the letters a new set
// of directions — the composition would visibly reshuffle mid-scroll.
function seededRandom(seed) {
	let s = seed >>> 0
	return () => {
		s = (s + 0x9e3779b9) | 0
		let t = s ^ (s >>> 16)
		t = Math.imul(t, 0x21f0aaad)
		t = t ^ (t >>> 15)
		t = Math.imul(t, 0x735a2d97)
		return ((t ^ (t >>> 15)) >>> 0) / 4294967296
	}
}

function buildStructure(el, text) {
	if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
	el.textContent = ''

	// The only copy that carries meaning. Everything else is aria-hidden.
	const reader = document.createElement('span')
	reader.textContent = text
	reader.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap'
	el.appendChild(reader)

	// Holds the element open at its natural size. Without it the overlay's
	// absolute positioning would collapse the line and shift the page.
	const placeholder = document.createElement('span')
	placeholder.setAttribute('aria-hidden', 'true')
	placeholder.style.cssText = 'visibility:hidden;pointer-events:none;user-select:none'
	placeholder.textContent = text
	el.appendChild(placeholder)

	const overlay = document.createElement('span')
	overlay.setAttribute('aria-hidden', 'true')
	overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;pointer-events:none'
	el.appendChild(overlay)

	return { placeholder, overlay }
}

function measureChars(el, raw, placeholder, overlay) {
	const box = el.getBoundingClientRect()
	const textNode = placeholder.firstChild
	const chars = []

	for (let i = 0; i < raw.length; i += 1) {
		if (raw[i] === ' ') continue

		const range = document.createRange()
		range.setStart(textNode, i)
		range.setEnd(textNode, i + 1)
		const r = range.getBoundingClientRect()

		const span = document.createElement('span')
		span.textContent = raw[i]
		span.style.cssText = [
			'position:absolute',
			`left:${r.left - box.left}px`,
			`top:${r.top - box.top}px`,
			`width:${r.width}px`,
			`height:${r.height}px`,
			'white-space:nowrap',
			'will-change:transform,opacity'
		].join(';')
		span._x = r.left - box.left
		overlay.appendChild(span)
		chars.push(span)
	}

	// Normalised across every line, so the ordering modes sweep horizontally
	// through wrapped text rather than restarting on each line.
	const xs = chars.map((c) => c._x)
	const min = Math.min(...xs)
	const span = Math.max(...xs) - min || 1
	for (const c of chars) c._normX = (c._x - min) / span

	return chars
}

function startTimeFor(char, order, stagger, randomness, rand) {
	const x = char._normX
	let ordered
	switch (order) {
		case 'ltr':
			ordered = x * stagger
			break
		case 'rtl':
			ordered = (1 - x) * stagger
			break
		case 'outward':
			// 0 at the edges, latest in the middle — the ends leave first.
			ordered = (1 - Math.abs(x - 0.5) * 2) * stagger
			break
		default:
			return rand() * stagger
	}
	return ordered * (1 - randomness) + rand() * stagger * randomness
}

function buildTimeline(el, chars, p) {
	const tl = gsap.timeline({ paused: true })

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: 1 })
		return tl
	}

	const rand = seededRandom(p.seed)
	const between = (min, max) => min + rand() * (max - min)

	const rad = (p.windAngle * Math.PI) / 180
	const windX = Math.cos(rad)
	const windY = -Math.sin(rad) // CSS Y grows downward; negate so 90° blows up

	for (const char of chars) {
		const at = startTimeFor(char, p.order, p.stagger, p.randomness, rand)
		const angle = rand() * Math.PI * 2
		const dist = rand() * p.scatter

		tl.fromTo(
			char,
			{ x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, opacity: 1 },
			{
				x: windX * p.windStrength + Math.cos(angle) * dist,
				y: windY * p.windStrength + Math.sin(angle) * dist,
				z: between(-p.depth, p.depth),
				rotationX: between(-p.maxRotation, p.maxRotation),
				rotationY: between(-p.maxRotation * 0.7, p.maxRotation * 0.7),
				rotationZ: between(-p.maxRotation * 0.3, p.maxRotation * 0.3),
				opacity: 0,
				duration: 1,
				ease: p.easing
			},
			at
		)
	}

	return tl
}

export function createFlyText(el, options = {}) {
	const p = { ...DEFAULTS, ...options }
	const raw = el.textContent.replace(/\s+/g, ' ').trim()
	const { placeholder, overlay } = buildStructure(el, raw)

	let tl = null

	const build = () => {
		if (tl) tl.kill()
		overlay.innerHTML = ''
		const chars = measureChars(el, raw, placeholder, overlay)
		if (!chars.length) return
		gsap.set(chars, { transformPerspective: 500 })
		tl = buildTimeline(el, chars, p)
	}

	build()

	return {
		progress(v) {
			if (tl) tl.progress(v)
		},
		// Re-measure after a resize, holding the position in the animation the
		// scroll is currently at so nothing jumps.
		rebuild() {
			const held = tl ? tl.progress() : 0
			build()
			if (tl) tl.progress(held)
		},
		destroy() {
			if (tl) tl.kill()
			tl = null
			el.textContent = raw
			el.style.position = ''
		}
	}
}
