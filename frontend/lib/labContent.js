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

const MARKER = /^(?:[-*•]|\d+[.)])\s+/

export function parseSections(text) {
	const sections = []
	let current = null

	for (const raw of String(text ?? '').split('\n')) {
		const line = raw.trim()
		if (!line) continue

		if (line.startsWith('#')) {
			current = { heading: line.replace(/^#+\s*/, ''), items: [] }
			sections.push(current)
			continue
		}

		if (!current) {
			current = { heading: null, items: [] }
			sections.push(current)
		}
		current.items.push(line.replace(MARKER, ''))
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

export function stepsOf(parts) {
	const steps = []
	parts.forEach((part, p) => {
		part.items.forEach((text, i) => {
			steps.push({
				part: p,
				label: `${p + 1}${letter(i)}`,
				title: part.heading,
				text,
			})
		})
	})
	return steps
}
