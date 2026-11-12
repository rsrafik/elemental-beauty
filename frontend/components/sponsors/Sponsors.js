'use client'

import { useEffect, useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { Card, CardNote, CardTitle, ConfirmDialog, Dialog, DialogActions, FIELD, Label, PencilIcon, PlusIcon, TrashIcon } from '@/components/analytics/parts'
import { sponsors as sponsorsApi } from '@/lib/api'
import { useDismiss } from '@/lib/dismiss'
import { canChange } from '@/lib/roles'
import { LIMITS, OFFER_LABELS, OFFERS, STATUSES, STATUS_LABELS, isContact, missingFrom, offerWords, requestBody } from '@/lib/sponsors'

// /sponsors: every sponsor the club has, from the landing page's "sponsor a
// batch" form or added here by hand, in four sections by where they stand:
//
//   pending      just came in, nobody's been in touch yet
//   contacting   someone's talking to them
//   active       sponsoring the club. Only an active one's pill shows on the
//                landing page.
//   archive      done with, or not going ahead. Archiving a sponsor with a
//                pill takes the pill off the page; making it active again
//                puts it back.
//
// The pills themselves (title, picture, website) are kept on /landing-editor,
// which connects any sponsor here to one. Only an admin can change anything —
// the advisor reads it all. The server holds the same rules
// (src/routes/sponsorRoutes.js).

const SECTIONS = {
	pending: { title: 'pending', note: 'Just came in. Nobody’s been in touch yet.', tint: 'bg-yellow' },
	contacting: { title: 'contacting', note: 'Someone’s talking to them.', tint: 'bg-lilac' },
	active: { title: 'active', note: 'Sponsoring the club. One with a pill shows on the landing page; connect one on the landing editor to give it a pill.', tint: 'bg-green' },
	archive: { title: 'archive', note: 'Done with, or not going ahead. Their pills stay off the landing page.', tint: 'bg-black/15' },
}

// ---- adding and editing ----------------------------------------------------

function OfferToggles({ picked, onChange }) {
	const toggle = (offer) => onChange(picked.includes(offer) ? picked.filter((one) => one !== offer) : [...picked, offer])
	return (
		<div className="
			flex
			flex-wrap
			gap-2
		">
			{OFFERS.map((offer) => {
				const on = picked.includes(offer)
				return (
					<button
						key={offer}
						type="button"
						aria-pressed={on}
						onClick={() => toggle(offer)}
						className={`
							rounded-full
							border
							px-4
							py-2
							font-vietnam
							text-sm
							cursor-pointer
							transition-colors
							${on ? 'border-black bg-black text-cream' : 'border-black/25 bg-white text-black hover:border-black'}
						`}
					>
						{OFFER_LABELS[offer]}
					</button>
				)
			})}
		</div>
	)
}

function TextField({ label, value, onChange, max, placeholder, area = false }) {
	const Input = area ? 'textarea' : 'input'
	return (
		<label className="block">
			<Label>{label}</Label>
			<Input
				type={area ? undefined : 'text'}
				value={value ?? ''}
				onChange={(event) => onChange(event.target.value)}
				maxLength={max}
				placeholder={placeholder}
				rows={area ? 4 : undefined}
				className={`${FIELD} ${area ? 'resize-y' : ''}`}
			/>
		</label>
	)
}

function SponsorDialog({ sponsor, startIn, onSave, onClose }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)
	const [values, setValues] = useState(() => (sponsor
		? {
			...sponsor,
			// one that was only ever a pill has its title for a name
			companyName: sponsor.companyName ?? sponsor.landingTitle ?? '',
		}
		: { offers: [], status: startIn ?? 'pending' }))
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const set = (key, value) => setValues((was) => ({ ...was, [key]: value }))

	const missing = missingFrom(values)
	const ready = !missing && !busy

	const submit = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			await onSave({ ...requestBody(values), status: values.status })
			dismiss(onClose)
		} catch (err) {
			setError(err.message)
			setBusy(false)
		}
	}

	return (
		<Dialog
			title={sponsor ? 'edit this sponsor' : 'add a sponsor'}
			note="Only the company is needed. The pill on the landing page is kept on the landing editor."
			onClose={close}
			onSubmit={submit}
			closing={closing}
			width="max-w-[520px]"
		>
			<div className="
				mt-6
				flex
				flex-col
				gap-4
			">
				<TextField label="company" value={values.companyName} onChange={(value) => set('companyName', value)} max={LIMITS.companyName} placeholder="Glow Co" />
				<TextField label="contact person (optional)" value={values.contactName} onChange={(value) => set('contactName', value)} max={LIMITS.contactName} placeholder="Jo Park" />
				<TextField label="contact info (optional)" value={values.contactInfo} onChange={(value) => set('contactInfo', value)} max={LIMITS.contactInfo} placeholder="jo@glow.com or (765) 555-0134" />
				<div>
					<Label>what they’re offering (optional)</Label>
					<OfferToggles picked={values.offers ?? []} onChange={(offers) => set('offers', offers)} />
				</div>
				{(values.offers ?? []).includes('other') && (
					<TextField label="the something else" value={values.offerOther} onChange={(value) => set('offerOther', value)} max={LIMITS.offerOther} placeholder="A venue for the spring showcase" />
				)}
				<TextField label="additional info (optional)" value={values.details} onChange={(value) => set('details', value)} max={LIMITS.details} area />
				<label className="block">
					<Label>section</Label>
					<select
						value={values.status}
						onChange={(event) => set('status', event.target.value)}
						className={FIELD}
					>
						{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
					</select>
				</label>

				{(error || missing) && (
					<p className={`
						font-vietnam
						text-sm
						${error ? 'text-salmon-dark' : 'text-black/45'}
					`}>
						{error || missing}
					</p>
				)}
			</div>

			<DialogActions
				onCancel={close}
				submitLabel={busy ? 'saving…' : sponsor ? 'save changes' : 'add them'}
				ready={ready}
			/>
		</Dialog>
	)
}

// ---- one sponsor -----------------------------------------------------------

function Tag({ className = '', children }) {
	return (
		<span className={`
			inline-flex
			items-center
			rounded-full
			px-2.5
			py-0.5
			font-vietnam
			text-[11px]
			whitespace-nowrap
			${className}
		`}>
			{children}
		</span>
	)
}

function RoundButton({ onClick, label, danger = false, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className={`
				w-8
				h-8
				inline-flex
				items-center
				justify-center
				rounded-full
				cursor-pointer
				transition-colors
				${danger
					? 'bg-salmon-lightest text-salmon-dark hover:bg-red hover:text-white'
					: 'bg-white text-black/60 hover:bg-black hover:text-white'}
			`}
		>
			{children}
		</button>
	)
}

// an email or a phone number opens the mail app or the phone; anything else
// is just shown
function Contact({ value }) {
	if (!value) return null
	if (!isContact(value)) return <span>{value}</span>
	const href = value.includes('@') ? `mailto:${value}` : `tel:${value.replace(/[^\d+]/g, '')}`
	return (
		<a href={href} className="underline underline-offset-2 decoration-black/30 hover:decoration-black">
			{value}
		</a>
	)
}

const received = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function SponsorRow({ sponsor, editable, onEdit, onMove, onRemove }) {
	const offers = offerWords(sponsor)
	const name = sponsor.name || 'Unnamed sponsor'

	return (
		<li className="
			rounded-[12px]
			bg-cream
			p-4
		">
			<div className="
				flex
				flex-wrap
				items-start
				justify-between
				gap-3
			">
				<div className="min-w-0">
					<p className="
						font-vietnam
						font-semibold
						text-base
						text-black
						break-words
					">
						{name}
					</p>
					<div className="
						mt-1.5
						flex
						flex-wrap
						gap-1.5
					">
						<Tag className={sponsor.source === 'form' ? 'bg-blue-light text-black/75' : 'bg-white text-black/60'}>
							{sponsor.source === 'form' ? `sent in on the form · ${received(sponsor.createdAt)}` : 'added by hand'}
						</Tag>
						{sponsor.onLanding && (
							<Tag className={sponsor.shown ? 'bg-yellow text-black/75' : 'bg-black/10 text-black/55'}>
								{sponsor.shown ? 'a pill on the landing page' : 'has a pill, hidden until it’s active'}
							</Tag>
						)}
					</div>
				</div>

				{editable && (
					<div className="
						flex
						items-center
						gap-1.5
					">
						<select
							value={sponsor.status}
							onChange={(event) => onMove(event.target.value)}
							aria-label={`Move ${name} to another section`}
							className="
								rounded-full
								border
								border-black/25
								bg-white
								px-3
								py-1.5
								font-vietnam
								text-xs
								text-black
								cursor-pointer
								hover:border-black
							"
						>
							{STATUSES.map((status) => (
								<option key={status} value={status}>
									{status === sponsor.status ? STATUS_LABELS[status] : `move to ${STATUS_LABELS[status]}`}
								</option>
							))}
						</select>
						<RoundButton onClick={onEdit} label={`Edit ${name}`}>
							<PencilIcon className="w-3.5 h-3.5" />
						</RoundButton>
						<RoundButton onClick={onRemove} label={`Delete ${name}`} danger>
							<TrashIcon className="w-3.5 h-3.5" />
						</RoundButton>
					</div>
				)}
			</div>

			<dl className="
				mt-3
				grid
				grid-cols-1
				gap-x-6
				gap-y-2
				font-vietnam
				text-sm
				sm:grid-cols-[max-content_1fr]
			">
				<Line term="contact">
					{sponsor.contactName || sponsor.contactInfo
						? <>{sponsor.contactName}{sponsor.contactName && sponsor.contactInfo ? ' · ' : ''}<Contact value={sponsor.contactInfo} /></>
						: null}
				</Line>
				<Line term="offering">{offers.length ? offers.join(', ') : null}</Line>
				<Line term="additional info">{sponsor.details}</Line>
			</dl>
		</li>
	)
}

function Line({ term, children }) {
	return (
		<>
			<dt className="
				text-[11px]
				uppercase
				tracking-[0.12em]
				text-black/45
				sm:pt-0.5
			">
				{term}
			</dt>
			<dd className={`
				break-words
				whitespace-pre-line
				-mt-1.5
				sm:mt-0
				${children ? 'text-black/80' : 'text-black/35'}
			`}>
				{children ?? 'not given'}
			</dd>
		</>
	)
}

// ---- a section -------------------------------------------------------------

function Section({ status, rows, editable, onAdd, onEdit, onMove, onRemove }) {
	const { title, note, tint } = SECTIONS[status]
	return (
		<Card>
			<div className="
				flex
				flex-wrap
				items-start
				justify-between
				gap-4
			">
				<div className="max-w-[60ch]">
					<div className="
						flex
						items-center
						gap-2.5
					">
						<span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${tint}`} />
						<CardTitle>{title}</CardTitle>
						<span className="
							font-vietnam
							text-sm
							text-black/40
						">
							{rows.length}
						</span>
					</div>
					<CardNote>{note}</CardNote>
				</div>
				{editable && (
					<button
						type="button"
						onClick={onAdd}
						className="
							inline-flex
							items-center
							gap-2
							rounded-full
							border
							border-black/25
							bg-white
							px-4
							py-2
							font-vietnam
							font-semibold
							text-sm
							text-black
							cursor-pointer
							hover:border-black
						"
					>
						<PlusIcon className="w-4 h-4" />
						add one here
					</button>
				)}
			</div>

			{rows.length === 0 ? (
				<p className="
					mt-6
					font-vietnam
					text-sm
					text-black/45
				">
					{status === 'pending' ? 'Nothing waiting. What comes in on the landing page’s form shows up here.' : 'Nobody here.'}
				</p>
			) : (
				<ul className="
					mt-6
					flex
					flex-col
					gap-3
				">
					{rows.map((sponsor) => (
						<SponsorRow
							key={sponsor.sponsorId}
							sponsor={sponsor}
							editable={editable}
							onEdit={() => onEdit(sponsor)}
							onMove={(to) => onMove(sponsor, to)}
							onRemove={() => onRemove(sponsor)}
						/>
					))}
				</ul>
			)}
		</Card>
	)
}

// ---- the page --------------------------------------------------------------

export default function Sponsors({ user }) {
	const [rows, setRows] = useState(null)
	const [error, setError] = useState(null)
	// { sponsor } to edit one, { startIn } to add one
	const [editing, setEditing] = useState(null)
	const [removing, setRemoving] = useState(null)
	const editable = canChange(user?.role)

	useEffect(() => {
		let live = true
		sponsorsApi.list()
			.then((list) => live && setRows(list))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [])

	const reload = async () => {
		setError(null)
		setRows(await sponsorsApi.list())
	}

	// the row moves at once; the list is fetched again either way
	const move = async (sponsor, status) => {
		setRows((list) => list.map((row) => (row.sponsorId === sponsor.sponsorId ? { ...row, status, shown: row.onLanding && status === 'active' } : row)))
		try {
			await sponsorsApi.move(sponsor.sponsorId, status)
			await reload()
		} catch (err) {
			setError(err.message)
			reload().catch(() => {})
		}
	}

	const save = async (body) => {
		if (editing.sponsor) await sponsorsApi.update(editing.sponsor.sponsorId, body)
		else await sponsorsApi.add(body)
		await reload()
	}

	const remove = async (sponsor) => {
		try {
			await sponsorsApi.remove(sponsor.sponsorId)
			await reload()
		} catch (err) {
			setError(err.message)
		}
	}

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			py-2
			lg:py-8
			pr-3
			lg:pr-11
			pl-3
		">
			<div className="
				page-stagger
				flex
				flex-col
				gap-6
			">
				<div className="
					flex
					flex-wrap
					items-center
					justify-between
					gap-3
				">
					<p className="
						max-w-[70ch]
						font-vietnam
						text-sm
						text-black/55
					">
						Everyone who’s sent in the landing page’s “sponsor a batch” form, and anyone added by hand. Move a sponsor along as it goes; the pills themselves are kept on the landing editor.
					</p>
					<div className="
						flex
						flex-wrap
						items-center
						gap-3
					">
						<a
							href="/landing-editor"
							className="
								rounded-full
								border
								border-black/25
								bg-white
								px-4
								py-2
								font-vietnam
								font-semibold
								text-sm
								text-black
								hover:border-black
							"
						>
							the landing editor
						</a>
						{editable && (
							<button
								type="button"
								onClick={() => setEditing({ startIn: 'pending' })}
								className="
									inline-flex
									items-center
									gap-2
									rounded-full
									bg-salmon
									px-4
									py-2
									font-vietnam
									font-semibold
									text-sm
									text-white
									cursor-pointer
									transition-all
									duration-200
									ease-out
									hover:-translate-y-0.5
									hover:shadow-lg
									hover:shadow-black/20
								"
							>
								<PlusIcon className="w-4 h-4" />
								add a sponsor
							</button>
						)}
					</div>
				</div>

				{error && (
					<p className="
						font-vietnam
						text-sm
						text-salmon-dark
					">
						{error}
					</p>
				)}

				{rows === null ? (
					!error && (
						<p className="
							font-vietnam
							text-sm
							text-black/40
						">
							loading…
						</p>
					)
				) : (
					STATUSES.map((status) => (
						<Section
							key={status}
							status={status}
							rows={rows.filter((row) => row.status === status)}
							editable={editable}
							onAdd={() => setEditing({ startIn: status })}
							onEdit={(sponsor) => setEditing({ sponsor })}
							onMove={move}
							onRemove={setRemoving}
						/>
					))
				)}
			</div>

			{editing && (
				<SponsorDialog
					sponsor={editing.sponsor}
					startIn={editing.startIn}
					onSave={save}
					onClose={() => setEditing(null)}
				/>
			)}
			{removing && (
				<ConfirmDialog
					title={`delete ${removing.name || 'this sponsor'}?`}
					body={[
						removing.onLanding ? 'It’s gone for good, and so is its pill on the landing page.' : 'It’s gone for good.',
						removing.status === 'archive' ? null : removing.onLanding
							? 'To only take the pill off the page, archive it instead.'
							: 'To keep a record of it, archive it instead.',
					].filter(Boolean).join(' ')}
					confirmLabel="delete"
					onCancel={() => setRemoving(null)}
					onConfirm={() => { remove(removing); setRemoving(null) }}
				/>
			)}
		</DashboardShell>
	)
}
