// A lab's ingredients, equipment and instructions are stored as plain text an
// officer can type into a box, and read back into sections here:
//
//   # Oils & Fats              a heading starts a section
//   - Coconut oil - 230g       every other line is one item in it
//   - Olive oil - 200g
//
//   # Lye Solution
//   1. Sodium hydroxide ...    "-", "*", "•" and "1." / "1)" markers are all
//                              dropped, so a pasted list works as-is
//
// Blank lines only separate things for the person typing. Items before the
// first heading land in a section with no heading.
//
// Instructions use the same shape: a heading is a part, an item is a step.
// They add one more kind of line — a warning, which belongs to the step above:
//
//   # Lye Solution
//   - Slowly add the NaOH to the water
//   ! Highly exothermic. Never add water to NaOH.
//
// A section's warnings sit in `warnings`, one list per item, so `items` stays
// a plain list of strings for the ingredients and equipment that never use it.

const MARKER = /^(?:[-*•]|\d+[.)])\s+/

export function parseSections(text) {
	const sections = []
	let current = null

	for (const raw of String(text ?? '').split('\n')) {
		const line = raw.trim()
		if (!line) continue

		if (line.startsWith('#')) {
			current = { heading: line.replace(/^#+\s*/, ''), items: [], warnings: [] }
			sections.push(current)
			continue
		}

		// a warning with no step above it to belong to is kept as a step, so
		// nothing typed is ever lost
		const warning = line.startsWith('!') ? line.replace(/^!+\s*/, '') : null
		if (warning && current?.items.length) {
			current.warnings[current.items.length - 1].push(warning)
			continue
		}
		if (warning === '') continue

		if (!current) {
			current = { heading: null, items: [], warnings: [] }
			sections.push(current)
		}
		current.items.push(warning ?? line.replace(MARKER, ''))
		current.warnings.push([])
	}

	return sections
}

// Instructions flattened into the flashcard deck: one card per step, each
// knowing its part (1-based) and its letter within the part — '1a', '1b', ...
// The letters run a–z, then aa, ab, … for a part that somehow has more.
function letter(index) {
	let out = ''
	let n = index
	do {
		out = String.fromCharCode(97 + (n % 26)) + out
		n = Math.floor(n / 26) - 1
	} while (n >= 0)
	return out
}

// Instructions as parseSections reads them, with one addition: a step typed
// the old way, its caution inline — "Stir until dissolved [CAUTION: hot]" —
// has the caution lifted out into a warning of its own, so labs written before
// warnings existed show them the same way.
const INLINE_CAUTION = /\s*\[\s*(?:caution|warning)\s*:\s*([^\]]*)\]/gi

export function parseInstructions(text) {
	return parseSections(text).map((part) => {
		const warnings = part.warnings.map((list) => [...list])
		const items = part.items.map((item, i) => {
			const lifted = [...item.matchAll(INLINE_CAUTION)].map((m) => m[1].trim()).filter(Boolean)
			if (!lifted.length) return item
			warnings[i].unshift(...lifted)
			return item.replace(INLINE_CAUTION, '').trim()
		})
		return { ...part, items, warnings }
	})
}

export function stepsOf(parts) {
	const steps = []
	parts.forEach((part, p) => {
		part.items.forEach((text, i) => {
			steps.push({
				part: p,
				label: `${p + 1}${letter(i)}`,
				title: part.heading,
				text,
				warnings: part.warnings?.[i] ?? [],
			})
		})
	})
	return steps
}
