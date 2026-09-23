'use client'

import { useMemo, useRef, useState } from 'react'
import { labs as labsApi } from '@/lib/api'
import { usePassQr } from '@/components/dashboards/ElementistPass'
import {
	LabIntro,
	ChunkyButton,
	ButtonCaption,
	Popup,
	PopupButton,
} from '@/components/labs/LabViewParts'

// The lab has started. Two halves, one component:
//
//   not checked in yet   "show QR code" under the description — the popup is
//                        the same check-in code as the Elementist pass, for an
//                        officer to scan at the door. The page above keeps
//                        re-reading the lab while this is up, so the moment the
//                        scan lands this swaps itself over to the quiz.
//   checked in           the lab quiz, two columns, numbered across the rows.
//
// The quiz needs 100% and can be retaken forever. After a miss, only the
// questions that were wrong come back, in the same layout with their original
// numbers; the right ones keep their answers and are sent along again, since the
// server always grades the whole quiz.

function ShowQrButton({ onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="
				mt-[28px]
				w-[137px]
				h-[38px]
				rounded-[10px]
				bg-transparent
				shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]
				font-boogaloo
				text-[20px]
				leading-none
				text-[#FF7C45]
				cursor-pointer
				transition-all
				duration-200
				ease-out
				hover:-translate-y-0.5
				hover:bg-black/[0.03]
				active:translate-y-0
			"
		>
			show QR code
		</button>
	)
}

function QrPopup({ onClose }) {
	const qr = usePassQr(true)

	return (
		<Popup title="your QR code" onClose={onClose}>
			{() => (
				<>
					<p className="
						font-vietnam
						text-sm
						text-black/60
						mt-3
					">
						Show this to an officer at the door to check in. The quiz opens
						here as soon as you&apos;re scanned.
					</p>
					<div className="
						mt-6
						mx-auto
						w-[240px]
						max-w-full
						aspect-square
						rounded-md
						bg-white
						overflow-hidden
						flex
						items-center
						justify-center
					">
						{qr
							? <img
								src={qr}
								alt="Your check-in code"
								className="
									w-full
									h-full
									object-contain
								"
							/>
							: <span className="
								font-vietnam
								text-sm
								text-black/40
							">
								loading…
							</span>}
					</div>
				</>
			)}
		</Popup>
	)
}

function Question({ number, question, picked, onPick }) {
	return (
		<div>
			<p className="
				font-vietnam
				font-semibold
				text-[15px]
				text-black
			">
				question {number})
			</p>
			<p className="
				font-vietnam
				text-[15px]
				leading-[18px]
				text-black
				mt-[4px]
			">
				{question.question}
			</p>
			<div
				role="radiogroup"
				aria-label={`question ${number}`}
				className="
					mt-[25px]
					flex
					flex-col
					gap-[13px]
				"
			>
				{question.options.map((option) => {
					const selected = picked === option.optionId
					return (
						<button
							key={option.optionId}
							type="button"
							role="radio"
							aria-checked={selected}
							onClick={() => onPick(option.optionId)}
							className={`
								w-full
								min-h-[38px]
								px-4
								py-1.5
								rounded-[30px]
								border
								border-[#AAAAAA]
								font-vietnam
								text-[15px]
								leading-[1.3]
								text-black
								text-center
								cursor-pointer
								transition-colors
								duration-150
								ease-out
								${selected ? 'bg-yellow-light' : 'bg-transparent hover:bg-yellow-light/30'}
							`}
						>
							{option.answerText}
						</button>
					)
				})}
			</div>
		</div>
	)
}

function ScorePopup({ result, onRetake, onClose }) {
	const percent = Math.round((result.correct / result.total) * 100)

	if (result.passed) {
		return (
			<Popup title="congrats!" onClose={onClose}>
				{(dismiss) => (
					<>
						<p className="
							font-dream
							text-[56px]
							leading-none
							text-green
							mt-6
							text-center
						">
							{result.correct}/{result.total}
						</p>
						<p className="
							font-vietnam
							text-sm
							text-black/60
							mt-4
							text-center
						">
							You got 100% — you can now access the lab.
						</p>
						<div className="
							mt-8
							flex
							justify-end
						">
							<PopupButton primary onClick={() => dismiss(onClose)}>
								yay!
							</PopupButton>
						</div>
					</>
				)}
			</Popup>
		)
	}

	return (
		<Popup title="your score" onClose={onRetake}>
			{(dismiss) => (
				<>
					<p className="
						font-dream
						text-[56px]
						leading-none
						text-salmon
						mt-6
						text-center
					">
						{result.correct}/{result.total}
					</p>
					<p className="
						font-vietnam
						font-semibold
						text-[15px]
						text-black/[0.53]
						mt-2
						text-center
					">
						{percent}%
					</p>
					<p className="
						font-vietnam
						text-sm
						text-black/60
						mt-4
						text-center
					">
						You need 100% to open the lab. Retake the quiz to try the{' '}
						{result.wrong.length === 1 ? 'question' : `${result.wrong.length} questions`}{' '}
						you missed.
					</p>
					<div className="
						mt-8
						flex
						justify-end
					">
						<PopupButton primary onClick={() => dismiss(onRetake)}>
							retake
						</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}

function LabQuiz({ lab, onPassed }) {
	const questions = useMemo(() => lab.quizQuestions ?? [], [lab.quizQuestions])
	// question id -> its number in the full quiz, which a retake keeps
	const numbers = useMemo(
		() => new Map(questions.map((q, i) => [q.questionId, i + 1])),
		[questions]
	)

	// { [questionId]: optionId } — one pick per question
	const [answers, setAnswers] = useState({})
	// null = every question; after a miss, the ids of the ones that were wrong
	const [showing, setShowing] = useState(null)
	const [result, setResult] = useState(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const boxRef = useRef(null)

	const visible = showing
		? questions.filter((q) => showing.includes(q.questionId))
		: questions
	const ready = visible.every((q) => answers[q.questionId] != null)

	const submit = async () => {
		if (!ready || busy) return
		setBusy(true)
		setError(null)
		try {
			const payload = Object.fromEntries(
				questions.map((q) => [q.questionId, answers[q.questionId] != null ? [answers[q.questionId]] : []])
			)
			const reply = await labsApi.submitQuiz(lab.labId, payload)
			// an already-passed quiz comes back as a bare { passed: true }
			setResult({
				passed: reply.passed,
				correct: reply.correct ?? questions.length,
				total: reply.total ?? questions.length,
				wrong: reply.wrong ?? [],
			})
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	// Only the misses come back, with their old picks cleared so a retake is a
	// fresh choice rather than the wrong answer already highlighted.
	const retake = () => {
		const wrong = result.wrong
		setAnswers((prev) => {
			const next = { ...prev }
			for (const id of wrong) delete next[id]
			return next
		})
		setShowing(wrong)
		setResult(null)
		boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	return (
		<div
			ref={boxRef}
			className="
				relative
				mt-[110px]
				lg:mt-[81px]
				mb-[40px]
				lg:mb-[82px]
				scroll-mt-[90px]
				rounded-[50px]
				shadow-[inset_0_0_13px_rgba(0,0,0,0.5)]
				px-6
				sm:px-10
				lg:pl-[66px]
				lg:pr-[80px]
				pt-[70px]
				lg:pt-[64px]
				pb-[63px]
			"
		>
			{/* the cloud sits astride the top edge, centred on it */}
			<div
				className="
					absolute
					left-1/2
					top-0
					-translate-x-1/2
					-translate-y-1/2
					w-[214px]
					h-[145.5px]
					bg-[url('/cloud-shadow.webp')]
					bg-contain
					bg-no-repeat
					bg-center
					flex
					items-center
					justify-center
					pl-[6px]
				"
			>
				<h2 className="
					font-starbim
					text-[27px]
					leading-none
					text-[#FF7C45]
				">
					LAB QUIZ
				</h2>
			</div>

			{questions.length === 0 ? (
				<p className="
					font-vietnam
					text-[15px]
					text-black/[0.53]
					text-center
				">
					This lab doesn&apos;t have a quiz yet — check back soon.
				</p>
			) : (
				<>
					<div className="
						grid
						grid-cols-1
						md:grid-cols-2
						gap-x-[60px]
						lg:gap-x-[114px]
						gap-y-[32px]
					">
						{visible.map((q) => (
							<Question
								key={q.questionId}
								number={numbers.get(q.questionId)}
								question={q}
								picked={answers[q.questionId]}
								onPick={(optionId) =>
									setAnswers((prev) => ({ ...prev, [q.questionId]: optionId }))
								}
							/>
						))}
					</div>

					<div className="
						mt-[72px]
						flex
						flex-col
						items-center
					">
						<ChunkyButton tone="green" onClick={submit} disabled={!ready || busy}>
							SUBMIT QUIZ
						</ChunkyButton>
						{!ready && <ButtonCaption>answer every question to submit</ButtonCaption>}
						{error && (
							<p className="
								font-vietnam
								text-sm
								text-salmon-dark
								text-center
								mt-2
							">
								{error}
							</p>
						)}
					</div>
				</>
			)}

			{result && (
				<ScorePopup
					result={result}
					onRetake={retake}
					onClose={() => {
						setResult(null)
						onPassed()
					}}
				/>
			)}
		</div>
	)
}

export default function MemberLabQuiz({ lab, checkedIn, onPassed }) {
	const [showQr, setShowQr] = useState(false)

	return (
		<>
			<LabIntro lab={lab}>
				{!checkedIn && <ShowQrButton onClick={() => setShowQr(true)} />}
			</LabIntro>

			{checkedIn && <LabQuiz lab={lab} onPassed={onPassed} />}

			{showQr && !checkedIn && <QrPopup onClose={() => setShowQr(false)} />}
		</>
	)
}
