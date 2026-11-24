'use client'

import { useState } from 'react'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'
import LastSent from '@/components/LastSent'
import { EmailDraftFields, useEmailDraft } from '@/components/EmailDraft'

// The check-in page's "email unpaid": everyone with a green $ who hasn't sent
// a payment in is reminded to pay by its payment due date, with every
// accepted payment's QR code attached (remindUnpaid in src/payments.js). It
// opens with the usual reminder written in, for the officer to change first.
//
//   count      how many it'll go to
//   intro      the line at the top, saying what they're reminded of
//   loadDraft  () -> the usual { subject, message }
//   onSend     (custom) -> the server's reply; throws if refused. `custom` is
//              the officer's { subject, message } if they changed it
//   lastSent   when it last went out (LastSent)

export default function UnpaidPopup({ count, intro, loadDraft, onSend, lastSent, onClose }) {
	const draft = useEmailDraft(loadDraft)
	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState(null)
	const ready = !busy && count > 0 && draft.ready

	const send = async (dismiss) => {
		if (!ready) return
		setBusy(true)
		setStatus(null)
		try {
			const reply = await onSend(draft.custom)
			setStatus({ text: reply?.message ?? 'Sent' })
			setTimeout(() => dismiss(onClose), 1400)
		} catch (err) {
			setStatus({ error: true, text: err.message })
			setBusy(false)
		}
	}

	return (
		<Popup title="email unpaid" onClose={onClose} width="max-w-[560px]">
			{(dismiss) => (
				<>
					<p className="
						mt-3
						font-vietnam
						text-sm
						text-black/70
					">
						{intro}
					</p>

					<EmailDraftFields
						draft={draft}
						placeholders={['{first name}', '{due date}']}
						note="Their payment due date, a pay button and the QR codes go along as usual."
					/>

					{status && (
						<p
							role="status"
							className={`
								mt-3
								font-vietnam
								font-semibold
								text-sm
								${status.error ? 'text-salmon-dark' : 'text-green-dark'}
							`}
						>
							{status.text}
						</p>
					)}

					<div className="
						mt-8
						flex
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismiss(onClose)}>cancel</PopupButton>
						<PopupButton primary disabled={!ready} onClick={() => send(dismiss)}>
							{busy ? 'sending…' : 'send them'}
						</PopupButton>
					</div>
					<LastSent last={lastSent} />
				</>
			)}
		</Popup>
	)
}
