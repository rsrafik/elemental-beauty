'use client'

import { Popup, PopupButton } from '@/components/labs/LabViewParts'

// What the two officer editors (the lab, and its quiz) are both made of: the
// small inset buttons, the labels with their red asterisk, and the boxes.
// Sizes are the design's pixels — the pages zoom them (see useDesignZoom).

// The design's inner-shadow controls: a plain shape with a 5px, 50% black
// shadow on the inside, as if pressed into the page. Pressing one lifts it out
// — it rises a touch and the shadow goes, like it's being pushed up from
// below. Shared with the check-in page's manual add button.
export const INSET = `
	shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]
	cursor-pointer
	transition-[translate,box-shadow]
	duration-150
	ease-out
	active:-translate-y-[2px]
	active:shadow-[inset_0_0_0_rgba(0,0,0,0)]
	disabled:opacity-50
	disabled:cursor-not-allowed
	disabled:active:translate-y-0
	disabled:active:shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]
`

// publish / save draft / discard, the two uploads and "add new section":
// 9px corners, 15px semibold.
export function EditorButton({ className = '', type = 'button', children, ...rest }) {
	return (
		<button
			type={type}
			className={`
				flex
				items-center
				justify-center
				rounded-[9px]
				bg-transparent
				font-vietnam
				font-semibold
				text-[15px]
				leading-none
				text-black
				whitespace-nowrap
				${INSET}
				${className}
			`}
			{...rest}
		>
			{children}
		</button>
	)
}

function MinusIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" className={className} aria-hidden="true">
			<path d="M7.5 12h9" />
		</svg>
	)
}

// The red minus hanging off the left of a question or an instructions
// section, which takes it out. Placed by the caller (it's absolutely positioned, so
// its parent needs to be `relative`) — centred on the label beside it.
export function RemoveButton({ label, onClick, className = '' }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className={`
				absolute
				-left-[30.7px]
				w-[19px]
				h-[19px]
				rounded-full
				flex
				items-center
				justify-center
				bg-red
				text-white
				cursor-pointer
				transition-transform
				duration-150
				ease-out
				hover:scale-110
				active:scale-95
				${className}
			`}
		>
			<MinusIcon className="w-[16px] h-[16px]" />
		</button>
	)
}

export function UploadIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M12 15V4.5M7.5 9L12 4.5 16.5 9" />
			<path d="M4.5 14.5v4.5h15v-4.5" />
		</svg>
	)
}

// An icon and its words, sat side by side inside an EditorButton.
export function IconLabel({ icon, children }) {
	return (
		<span className="
			inline-flex
			items-center
			justify-center
			gap-[11px]
		">
			{icon}
			<span>{children}</span>
		</span>
	)
}

export function Asterisk() {
	return <span className="text-red" aria-hidden="true">*</span>
}

export function FieldLabel({ htmlFor, required = false, className = '', children }) {
	return (
		<label
			htmlFor={htmlFor}
			className={`
				block
				font-vietnam
				font-semibold
				text-[15px]
				leading-[18px]
				text-black
				${className}
			`}
		>
			{children}
			{required && <Asterisk />}
		</label>
	)
}

// The white boxes. `tone` is the border: orange for the lab's details and the
// quiz, pink for materials, green for the instructions. A field that's
// missing on publish goes red until it's filled.
const BORDERS = {
	orange: 'border-orange',
	pink: 'border-[#FF3992]',
	green: 'border-[#6AAC24]',
}

export function fieldClass(tone = 'orange', invalid = false) {
	return `
		w-full
		rounded-[5px]
		border
		bg-white
		font-vietnam
		text-[15px]
		text-black
		outline-none
		transition-shadow
		duration-150
		focus:shadow-[0_0_0_2px_rgba(255,125,69,0.2)]
		placeholder:text-[#A6A6A6]
		${invalid ? 'border-red shadow-[0_0_0_2px_rgba(255,25,25,0.15)]' : BORDERS[tone]}
	`
}

// "discard changes?" — asked before an editor throws away work.
export function DiscardPopup({ onCancel, onConfirm }) {
	return (
		<Popup title="discard?" onClose={onCancel}>
			{(dismiss) => (
				<>
					<p className="
						font-vietnam
						text-sm
						text-black/60
						mt-3
					">
						Everything you haven&apos;t published goes, including any saved
						draft. What&apos;s live stays as it is.
					</p>
					<div className="
						mt-8
						flex
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismiss(onCancel)}>keep editing</PopupButton>
						<PopupButton primary onClick={() => dismiss(onConfirm)}>discard</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}

// The line under the publish / save draft / discard row: what just happened,
// or what's stopping a publish.
export function StatusLine({ status }) {
	if (!status) return null
	return (
		<p
			role="status"
			className={`
				mt-[10px]
				font-vietnam
				font-semibold
				text-[13px]
				text-center
				${status.error ? 'text-red' : 'text-green-dark'}
			`}
		>
			{status.text}
		</p>
	)
}

// publish / save draft / discard, 121.7 × 32 each, 41.7 apart.
export function PublishBar({ onPublish, onDraft, onDiscard, busy }) {
	const size = 'w-[121.7px] h-[32px] shrink-0'
	return (
		<div className="
			flex
			justify-center
			gap-4
			sm:gap-[41.7px]
		">
			<EditorButton className={size} onClick={onPublish} disabled={busy}>publish</EditorButton>
			<EditorButton className={size} onClick={onDraft} disabled={busy}>save draft</EditorButton>
			<EditorButton className={size} onClick={onDiscard} disabled={busy}>discard</EditorButton>
		</div>
	)
}
