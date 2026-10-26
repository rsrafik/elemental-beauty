'use client'

// The line at the bottom of each send-an-email popup — "email all", "email
// unpaid", "confirmation" — saying when that email last went out (the API's
// { sentAt, deadline, sent }, or null for never; see src/emailSends.js). A
// confirmation's says the deadline it set, too. Bold, in blue, so it reads
// apart from the popup's own text.
//
// `undefined` is still being asked: nothing's drawn until the answer's in.

const when = (at) => new Date(at).toLocaleString('en-US', {
	weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})

export default function LastSent({ last, deadline = false }) {
	if (last === undefined) return null
	return (
		<p className="
			mt-5
			font-vietnam
			font-bold
			text-[13px]
			leading-snug
			text-blue-med
		">
			{last
				? <>
					last sent {when(last.sentAt)}
					{deadline && last.deadline && <> · confirm by {when(last.deadline)}</>}
				</>
				: 'not sent yet'}
		</p>
	)
}
