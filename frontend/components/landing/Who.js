import { WHO } from './content'

// Phase A: who we are.
//
// The label is the section's heading. Under it, one long sentence, set large
// in the serif, that inks itself in a word at a
// time as it is scrolled through (Motion.js fades each `data-word` up from a
// ghost of itself).
//
// The statement comes from content.js with *stars* around the words that take
// the italic and a pigment.

const PIGMENTS = ['text-salmon-med', 'text-lilac-dark', 'text-green-dark']

function words(statement) {
	let pigment = 0
	return statement.split(' ').map((word, index) => {
		const marked = word.startsWith('*')
		const text = word.replaceAll('*', '')
		return (
			<span key={index}>
				<span
					data-word
					className={`
						inline-block
						${marked ? `italic ${PIGMENTS[pigment++ % PIGMENTS.length]}` : ''}
					`}
				>
					{text}
				</span>{' '}
			</span>
		)
	})
}

export default function Who() {
	return (
		<section
			id="who"
			className="
				relative
				py-sec-l
			"
		>
			<div className="
				grid
				grid-cols-4
				gap-x-gutter
				gap-y-sec-s
				px-edge
				lg:grid-cols-6
			">
				{/* the section's heading, for screen readers and the outline; the
				    sentence is what a sighted reader gets */}
				<h2 className="sr-only">{WHO.title}</h2>

				<p
					data-words
					className="
						type-serif
						col-span-full
						text-center
						text-h3
						lg:text-h1
					"
				>
					{words(WHO.statement)}
				</p>
			</div>
		</section>
	)
}
