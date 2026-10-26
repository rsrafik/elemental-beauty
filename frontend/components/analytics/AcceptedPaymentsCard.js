'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardNote, CardTitle, Dialog, DialogActions, FIELD, Label, PlusIcon, TrashIcon } from '@/components/analytics/parts'
import { paymentMethods as methodsApi } from '@/lib/api'
import { useDismiss } from '@/lib/dismiss'
import { shrinkImage } from '@/lib/images'

// How members pay the club, for the treasurer (and admin) to keep: each one is
// a choice in the payment dropdown on a lab's or event's page and /vip, its QR
// code sits above that form with its line printed under it, and every QR code
// is attached to the check-in page's "email unpaid" reminder.
//
//   platform     what the dropdown says — 'Venmo' (required)
//   QR code      a photo or screenshot of it (optional)
//   description  a smaller line under the QR code — '@elementalbeauty' (optional)
//
// Clicking one opens the same form filled in, to change any of it. Payments
// already sent in under one keep the name it had then, so renaming or taking
// one off changes nothing that's been sent (src/routes/paymentMethodRoutes.js).
//
// Under them, what renting goggles for a lab costs (GogglePrice): every lab's
// page offers a pair at that price, up to 24 hours before it starts, and an
// approved rental is filed under the 'goggle rental' income. 0 turns it off.

// big enough to scan off a phone, small enough to ride along on every read
const QR_MAX = 800

// `method` null is adding one; otherwise it's the one being changed, and the
// form opens on what it says now.
function MethodDialog({ method, onClose, onSaved }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)
	const picker = useRef(null)
	const [title, setTitle] = useState(method?.title ?? '')
	const [description, setDescription] = useState(method?.description ?? '')
	const [image, setImage] = useState(method?.image ?? null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)

	const pick = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		try {
			setImage(await shrinkImage(file, QR_MAX, { quality: 0.92 }))
		} catch (err) {
			setError(err.message)
		}
	}

	const ready = title.trim() !== '' && !busy
	const submit = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			const body = { title: title.trim(), description: description.trim() || null, image }
			if (method) await methodsApi.update(method.methodId, body)
			else await methodsApi.add(body)
			await onSaved()
			dismiss(onClose)
		} catch (err) {
			setError(err.message)
			setBusy(false)
		}
	}

	return (
		<Dialog
			title={method ? 'edit this way to pay' : 'add a way to pay'}
			note={method
				? 'Payments already sent in keep the name they were sent under.'
				: 'Members pick it from the payment dropdown, under its QR code.'}
			onClose={close}
			onSubmit={submit}
			closing={closing}
			width="max-w-[460px]"
		>
			<div className="
				mt-6
				flex
				flex-col
				gap-4
			">
				<div>
					<Label>QR code (optional)</Label>
					<div className="
						flex
						items-center
						gap-4
					">
						<button
							type="button"
							onClick={() => picker.current?.click()}
							aria-label={image ? 'Change the QR code' : 'Add a QR code'}
							className="
								w-24
								h-24
								shrink-0
								flex
								items-center
								justify-center
								rounded-[10px]
								overflow-hidden
								bg-white
								border
								border-dashed
								border-black/30
								cursor-pointer
								hover:border-black
							"
						>
							{image
								? <img src={image} alt="" className="w-full h-full object-contain" />
								: <PlusIcon className="w-6 h-6 text-black/35" />}
						</button>
						<div className="
							font-vietnam
							text-xs
							text-black/50
						">
							A screenshot of the QR code from the app works.
							{image && (
								<>
									<br />
									<button
										type="button"
										onClick={() => setImage(null)}
										className="
											mt-1
											underline
											underline-offset-2
											cursor-pointer
											hover:text-black
										"
									>
										remove it
									</button>
								</>
							)}
						</div>
						<input ref={picker} type="file" accept="image/*" onChange={pick} className="hidden" />
					</div>
				</div>

				<label className="block">
					<Label>payment platform</Label>
					<input
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						maxLength={60}
						placeholder="Venmo"
						className={FIELD}
					/>
				</label>

				<label className="block">
					<Label>under the QR code (optional)</Label>
					<input
						type="text"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						maxLength={200}
						placeholder="@elementalbeauty, put your name in the note"
						className={FIELD}
					/>
				</label>

				{error && (
					<p className="
						font-vietnam
						text-sm
						text-salmon-dark
					">
						{error}
					</p>
				)}
			</div>

			<DialogActions
				onCancel={close}
				submitLabel={method ? (busy ? 'saving…' : 'save changes') : (busy ? 'adding…' : 'add it')}
				ready={ready}
			/>
		</Dialog>
	)
}

export default function AcceptedPaymentsCard() {
	const [methods, setMethods] = useState(null)
	// the form: null = closed, { method } = adding (null) or editing that one
	const [editing, setEditing] = useState(null)
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(null)

	const load = () => methodsApi.list().then(setMethods)

	useEffect(() => {
		let live = true
		methodsApi.list()
			.then((rows) => live && setMethods(rows))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [])

	const remove = async (method) => {
		setBusy(method.methodId)
		setError(null)
		try {
			await methodsApi.remove(method.methodId)
			await load()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(null)
		}
	}

	return (
		<Card>
			<div className="
				flex
				flex-wrap
				items-start
				justify-between
				gap-4
			">
				<div>
					<CardTitle>accepted payments</CardTitle>
					<CardNote>
						How members pay before they come: the platforms on a lab’s or event’s page and /vip, each under its QR code. The reminder emails attach them too.
					</CardNote>
				</div>
				<button
					type="button"
					onClick={() => setEditing({ method: null })}
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
					add
				</button>
			</div>

			{error && (
				<p className="
					mt-3
					font-vietnam
					text-sm
					text-salmon-dark
				">
					{error}
				</p>
			)}

			{methods === null ? (
				<p className="
					mt-6
					font-vietnam
					text-sm
					text-black/40
				">
					loading…
				</p>
			) : methods.length === 0 ? (
				<p className="
					mt-6
					font-vietnam
					text-sm
					text-black/45
				">
					None yet. Add how members can pay you, and they’ll see it on every lab they owe for.
				</p>
			) : (
				<ul className="
					mt-6
					flex
					flex-wrap
					gap-4
				">
					{methods.map((method) => (
						<li
							key={method.methodId}
							className="
								relative
								w-[168px]
								rounded-[12px]
								bg-cream
								p-3
							"
						>
							{/* the whole tile opens it for editing; the bin is its own */}
							<button
								type="button"
								onClick={() => setEditing({ method })}
								aria-label={`Edit ${method.title}`}
								className="
									block
									w-full
									text-left
									cursor-pointer
									rounded-[8px]
									transition-transform
									duration-150
									hover:-translate-y-0.5
								"
							>
								<div className="
									w-full
									aspect-square
									flex
									items-center
									justify-center
									rounded-[8px]
									overflow-hidden
									bg-white
								">
									{method.image
										? <img src={method.image} alt={`${method.title} QR code`} className="w-full h-full object-contain" />
										: <span className="font-vietnam text-xs text-black/35">no QR code</span>}
								</div>
								<p className="
									mt-2
									pr-8
									font-vietnam
									font-semibold
									text-sm
									text-black
									break-words
								">
									{method.title}
								</p>
								{method.description && (
									<p className="
										mt-0.5
										pr-8
										font-vietnam
										text-xs
										text-black/50
										break-words
									">
										{method.description}
									</p>
								)}
							</button>
							<button
								type="button"
								onClick={() => remove(method)}
								disabled={busy === method.methodId}
								aria-label={`Remove ${method.title}`}
								title={`Remove ${method.title}`}
								className="
									absolute
									bottom-3
									right-3
									w-7
									h-7
									inline-flex
									items-center
									justify-center
									rounded-full
									bg-salmon-lightest
									text-salmon-dark
									cursor-pointer
									transition-colors
									hover:bg-red
									hover:text-white
									disabled:opacity-40
								"
							>
								<TrashIcon className="w-3.5 h-3.5" />
							</button>
						</li>
					))}
				</ul>
			)}

			<GogglePrice />

			{editing && <MethodDialog method={editing.method} onClose={() => setEditing(null)} onSaved={load} />}
		</Card>
	)
}

function GogglePrice() {
	// what the server has, and what's in the box
	const [saved, setSaved] = useState(null)
	const [draft, setDraft] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)

	useEffect(() => {
		let live = true
		methodsApi.goggles()
			.then((reply) => {
				if (!live) return
				setSaved(reply.price)
				setDraft(reply.price ? String(reply.price) : '')
			})
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [])

	const price = draft.trim() === '' ? 0 : Number(draft)
	const valid = Number.isFinite(price) && price >= 0
	const ready = saved !== null && valid && price !== saved && !busy

	const save = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			const reply = await methodsApi.setGoggles(price)
			setSaved(reply.price)
			setDraft(reply.price ? String(reply.price) : '')
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<form onSubmit={save} className="
			mt-8
			border-t
			border-black/10
			pt-6
		">
			<Label htmlFor="goggle-price">goggle rental</Label>
			<div className="
				mt-1.5
				flex
				flex-wrap
				items-center
				gap-3
			">
				<div className="
					relative
					w-[140px]
				">
					<span className="
						pointer-events-none
						absolute
						left-4
						top-1/2
						-translate-y-1/2
						font-vietnam
						text-sm
						text-black/50
					">
						$
					</span>
					<input
						id="goggle-price"
						aria-label="Goggle rental price"
						type="number"
						min="0"
						step="0.01"
						inputMode="decimal"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="0"
						className={`${FIELD} pl-8`}
					/>
				</div>
				<button
					type="submit"
					disabled={!ready}
					className={`
						rounded-full
						px-5
						py-2
						font-vietnam
						font-semibold
						text-sm
						transition-all
						duration-200
						ease-out
						${ready
							? 'bg-salmon text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20'
							: 'bg-black/10 text-black/40 cursor-not-allowed'}
					`}
				>
					{busy ? 'saving…' : 'save'}
				</button>
			</div>
			<p className="
				mt-2
				font-vietnam
				text-xs
				text-black/50
			">
				{saved
					? 'Every lab’s page offers goggles at this price, up to 24 hours before it starts. Approved rentals go under goggle rental income. Set it to 0 to stop renting them.'
					: 'Not renting goggles right now. Set a price and every lab’s page offers them, up to 24 hours before it starts.'}
			</p>
			{error && (
				<p className="
					mt-2
					font-vietnam
					text-sm
					text-salmon-dark
				">
					{error}
				</p>
			)}
		</form>
	)
}
