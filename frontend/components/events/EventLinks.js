'use client'

import { useState } from 'react'

// An event's links — a guest speaker's LinkedIn, a sign-up sheet — as
// [{ title, url }]. Two halves:
//
//   LinksField   the event forms' editor (the calendar's "new event" and the
//                events page's dialog): a title and an address per row, a +
//                for another row, an x to drop one. Rows left without an
//                address are dropped when it saves (the API does the same).
//   LinkList     what an event's page shows under its photo.
//
// The API puts https:// on an address typed without it (eventRoutes.js) —
// which is also why the address box is a text field rather than type="url":
// the browser would refuse to submit 'linkedin.com/in/…' as it stands.

function PlusIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7.5v9M7.5 12h9" />
		</svg>
	)
}

function CloseIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M6 6l12 12M18 6L6 18" />
		</svg>
	)
}

function LinkIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
			<path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
		</svg>
	)
}

// The rows worth sending: trimmed, and only those with an address.
export function cleanLinks(links) {
	return links
		.map((link) => ({ title: link.title.trim(), url: link.url.trim() }))
		.filter((link) => link.url !== '')
}

// `fieldClass` and `Label` are the form's own, so the rows match the fields
// around them.
export function LinksField({ links, onChange, fieldClass, Label }) {
	const setRow = (index, key) => (event) =>
		onChange(links.map((link, at) => (at === index ? { ...link, [key]: event.target.value } : link)))
	const remove = (index) => onChange(links.filter((_, at) => at !== index))
	// a row added with the + takes the cursor; the ones the form opened with
	// don't
	const [grew, setGrew] = useState(false)
	const add = () => {
		setGrew(true)
		onChange([...links, { title: '', url: '' }])
	}

	return (
		<div>
			<Label>links</Label>
			<div className="
				flex
				flex-col
				gap-2
			">
				{links.map((link, index) => (
					<div
						key={index}
						className="
							flex
							items-center
							gap-2
						"
					>
						<input
							type="text"
							value={link.title}
							onChange={setRow(index, 'title')}
							autoFocus={grew && index === links.length - 1}
							placeholder="Title"
							aria-label={`Link ${index + 1} title`}
							className={`${fieldClass} flex-[2] min-w-0`}
						/>
						<input
							type="text"
							inputMode="url"
							value={link.url}
							onChange={setRow(index, 'url')}
							placeholder="https://..."
							aria-label={`Link ${index + 1} address`}
							className={`${fieldClass} flex-[3] min-w-0`}
						/>
						<button
							type="button"
							onClick={() => remove(index)}
							aria-label={`Remove link ${index + 1}`}
							title="Remove this link"
							className="
								w-8
								h-8
								shrink-0
								flex
								items-center
								justify-center
								rounded-full
								text-black/45
								cursor-pointer
								transition-colors
								duration-200
								hover:bg-black/5
								hover:text-black
							"
						>
							<CloseIcon className="w-3.5 h-3.5" />
						</button>
					</div>
				))}
			</div>
			<button
				type="button"
				onClick={add}
				className={`
					group
					${links.length ? 'mt-2' : ''}
					inline-flex
					items-center
					gap-1.5
					font-vietnam
					text-sm
					text-black/60
					cursor-pointer
					transition-colors
					duration-200
					hover:text-black
				`}
			>
				<PlusIcon className="
					w-4
					h-4
					transition-transform
					duration-200
					ease-out
					group-hover:rotate-90
				" />
				{links.length ? 'add another link' : 'add a link'}
			</button>
		</div>
	)
}

// 'https://www.linkedin.com/in/x' -> 'linkedin.com', for a link with no title
function hostOf(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return url
	}
}

// Under the event's photo: one line per link, opening in a new tab.
export function LinkList({ links, className = '' }) {
	if (!links?.length) return null
	return (
		<ul className={`
			flex
			flex-col
			gap-1.5
			${className}
		`}>
			{links.map((link) => (
				<li key={`${link.url}-${link.title}`} className="min-w-0">
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						className="
							group
							inline-flex
							max-w-full
							items-center
							gap-1.5
							font-vietnam
							font-semibold
							text-[14px]
							text-blue-med
							hover:text-blue
						"
					>
						<LinkIcon className="w-4 h-4 shrink-0" />
						<span className="
							truncate
							underline
							underline-offset-2
							decoration-blue-med/30
							group-hover:decoration-current
						">
							{link.title || hostOf(link.url)}
						</span>
					</a>
				</li>
			))}
		</ul>
	)
}
