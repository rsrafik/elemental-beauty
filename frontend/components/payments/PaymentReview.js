'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { payments as paymentsApi } from '@/lib/api'
import { useDismiss } from '@/lib/dismiss'

// A payment a member sent in, as the treasurer or admin reviews it — the
// check-in page's payments popup and the dues card's "pending" filter both
// draw it. See src/routes/paymentRoutes.js.
//
//   PaymentDetails   what it's for, how much, how it was paid (platform and
//                    transaction id) and when
//   ScreenshotCircle their screenshot, if they added one, as a circle at the
//                    row's left — like a receipt's photo — which opens it
//                    full size in a popup (not a new tab: a data URL can't be)
//   ReviewButtons    approve (writes the income row, settles it and confirms
//                    their spot), send back (asks why; they have 48 hours to
//                    fix it and send it again, for a lab or event, or they're
//                    moved to its waitlist) or reject (not accepted, and
//                    they're moved to the waitlist now — the reason's
//                    optional). Each emails them.
//
// `payment` is the API's shape: { paymentId, kind, title, schoolYear, amount,
// methodTitle, reference, screenshot, submittedAt, ... }.

const money = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const sentOn = (at) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// 'lab fee · $20.00' / 'VIP dues 2026–27 · $25.00'
export function paymentWhat(payment) {
	return payment.kind === 'dues'
		? `VIP dues ${payment.schoolYear} · ${money(payment.amount)}`
		: `${payment.eventId ? 'event' : 'lab'} fee · ${money(payment.amount)}`
}

export function PaymentDetails({ payment, showTitle = false }) {
	return (
		<div className="
			min-w-0
			font-vietnam
			text-xs
			text-black/55
		">
			<p className="
				font-semibold
				text-black/80
			">
				{paymentWhat(payment)}
				{showTitle && payment.title && <span className="font-normal text-black/45"> · from {payment.title}</span>}
			</p>
			<p className="mt-0.5">
				{payment.methodTitle} · <span className="font-semibold text-black/70">#{payment.reference}</span> · sent {sentOn(payment.submittedAt)}
			</p>
		</div>
	)
}

// `who` names it in the popup. Draws a same-sized blank when there's no
// screenshot, so the names in a list stay lined up (`blank`), or nothing.
export function ScreenshotCircle({ src, who, blank = false }) {
	const [open, setOpen] = useState(false)
	if (!src) return blank ? <span className="w-10 h-10 shrink-0" /> : null
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={`See ${who}'s payment screenshot`}
				title="See their screenshot"
				className="
					w-10
					h-10
					shrink-0
					overflow-hidden
					rounded-full
					bg-white
					border
					border-black/15
					cursor-pointer
					transition-transform
					duration-150
					hover:scale-105
				"
			>
				<img src={src} alt="" className="w-full h-full object-cover" />
			</button>
			{open && <ImagePopup src={src} title={`${who}'s screenshot`} onClose={() => setOpen(false)} />}
		</>
	)
}

// The picture full size over a dimmed page; the backdrop or the x closes it.
// Portalled to <body>, out of any zoomed or scrolling box it was opened from.
function ImagePopup({ src, title, onClose }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)
	return createPortal(
		<div
			onClick={close}
			className={`
				fixed
				inset-0
				z-[60]
				flex
				items-center
				justify-center
				bg-black/60
				p-4
				sm:p-8
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
		>
			<figure
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="
					relative
					max-w-[min(720px,100%)]
					rounded-[16px]
					bg-cream
					p-3
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<img
					src={src}
					alt={title}
					className="
						block
						max-h-[80dvh]
						max-w-full
						rounded-[10px]
					"
				/>
				<figcaption className="
					mt-2
					px-1
					font-vietnam
					text-xs
					text-black/55
				">
					{title}
				</figcaption>
				<button
					type="button"
					onClick={close}
					aria-label="Close"
					className="
						absolute
						-top-3
						-right-3
						w-9
						h-9
						flex
						items-center
						justify-center
						rounded-full
						bg-black
						text-cream
						cursor-pointer
						hover:brightness-125
					"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="w-4 h-4" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</figure>
		</div>,
		document.body
	)
}

function Button({ tone, onClick, disabled, children, title }) {
	const tones = {
		approve: 'bg-green text-[#295212] hover:brightness-95',
		reject: 'bg-salmon-lightest text-salmon-dark hover:bg-salmon hover:text-white',
		quiet: 'text-black/50 hover:text-black',
		sendBack: 'bg-yellow-light text-yellow-dark hover:brightness-95',
	}
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={`
				rounded-full
				px-3
				py-1
				font-vietnam
				font-semibold
				text-xs
				whitespace-nowrap
				transition-all
				duration-150
				${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
				${tones[tone]}
			`}
		>
			{children}
		</button>
	)
}

// `onDone` runs after either answer has been saved (the caller re-reads);
// `readOnly` is the advisor, who sees what's waiting but settles none of it.
// what each of the two "no"s asks, and does
const NO = {
	'send-back': {
		label: 'send back',
		placeholder: 'What needs fixing? They’ll see this and have 48 hours to send it again',
		submit: 'send it back',
		busy: 'sending…',
		required: true,
		call: (id, reason) => paymentsApi.sendBack(id, reason),
	},
	reject: {
		label: 'reject',
		placeholder: 'Why? (optional) They’re moved to the waitlist and emailed',
		submit: 'reject it',
		busy: 'rejecting…',
		required: false,
		call: (id, reason) => paymentsApi.reject(id, reason),
	},
}

export function ReviewButtons({ payment, onDone, readOnly = false }) {
	const [busy, setBusy] = useState(null)
	const [error, setError] = useState(null)
	// which "no" is having its reason written: 'send-back' / 'reject' / null
	const [asking, setAsking] = useState(null)
	const [reason, setReason] = useState('')

	if (readOnly) return null

	const run = async (which, call) => {
		setBusy(which)
		setError(null)
		try {
			await call()
			setAsking(null)
			setReason('')
			await onDone?.()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(null)
		}
	}

	const no = asking ? NO[asking] : null
	const ready = no && (!no.required || reason.trim()) && !busy

	return (
		<div className="
			flex
			flex-col
			items-end
			gap-2
		">
			{!no ? (
				<div className="
					flex
					items-center
					gap-2
				">
					<Button
						tone="approve"
						disabled={Boolean(busy)}
						title="It's in the account. Book it as income, confirm their spot, and let them know"
						onClick={() => run('approve', () => paymentsApi.approve(payment.paymentId))}
					>
						{busy === 'approve' ? 'approving…' : 'approve'}
					</Button>
					<Button
						tone="sendBack"
						disabled={Boolean(busy)}
						title="Something's off. They fix it and send it again within 48 hours"
						onClick={() => setAsking('send-back')}
					>
						send back
					</Button>
					<Button
						tone="reject"
						disabled={Boolean(busy)}
						title="Not accepted. They're moved to the waitlist"
						onClick={() => setAsking('reject')}
					>
						reject
					</Button>
				</div>
			) : (
				<form
					onSubmit={(event) => {
						event.preventDefault()
						if (ready) run(asking, () => no.call(payment.paymentId, reason.trim()))
					}}
					className="
						w-full
						min-w-[240px]
						flex
						flex-col
						items-end
						gap-2
					"
				>
					<textarea
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						rows={2}
						autoFocus
						placeholder={no.placeholder}
						aria-label={asking === 'reject' ? 'Why it’s being rejected' : 'What they need to fix'}
						className="
							w-full
							rounded-[10px]
							border
							border-black/25
							bg-white
							px-3
							py-2
							font-vietnam
							text-xs
							text-black
							outline-none
							focus:border-black
						"
					/>
					<div className="
						flex
						gap-2
					">
						<Button tone="quiet" onClick={() => setAsking(null)} disabled={Boolean(busy)}>cancel</Button>
						<button
							type="submit"
							disabled={!ready}
							className={`
								rounded-full
								px-3
								py-1
								font-vietnam
								font-semibold
								text-xs
								${asking === 'reject' ? 'bg-red' : 'bg-salmon'}
								text-white
								${!ready ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-95'}
							`}
						>
							{busy ? no.busy : no.submit}
						</button>
					</div>
				</form>
			)}
			{error && (
				<p className="
					max-w-[260px]
					font-vietnam
					text-xs
					text-salmon-dark
					text-right
				">
					{error}
				</p>
			)}
		</div>
	)
}
