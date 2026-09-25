'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { labs as labsApi } from '@/lib/api'
import { isoDate, today } from '@/lib/dates'
import { BackButton, Scaled } from '@/components/labs/LabViewParts'
import MemberLabSignup from '@/components/labs/MemberLabSignup'
import MemberLabQuiz from '@/components/labs/MemberLabQuiz'
import MemberLabContent from '@/components/labs/MemberLabContent'

// /labs/view?id=N for a user or member. Which of the three stages you get is
// worked out from the lab's date/time and your row on it:
//
//   signup   before it starts — sign up / registered / waitlisted
//            (MemberLabSignup). Also where you land if it has started and
//            you never signed up, since signing up is still the way in.
//   checkin  it has started and you hold a seat or a waitlist place: show the
//            QR at the door (MemberLabQuiz, not checked in)
//   quiz     you've been checked in and haven't passed yet (MemberLabQuiz)
//   lab      you've passed — the full lab: materials, lesson, instructions
//            (MemberLabContent)
//
// The signup stage sits in the middle of the page; the others are top-aligned
// because the quiz runs on below them. Both are laid out in the design's own
// pixels inside `Scaled` (see LabViewParts), with the insets measured off the
// mockups: from the left of the content column to the text, and from the
// photo to the right edge.

// How often the page looks at the clock (so it flips to check-in at start
// time) and, while the QR is up, re-reads the lab to catch the scan.
const CLOCK_MS = 30_000
const CHECKIN_POLL_MS = 5_000

function nowHHMM() {
	const now = new Date()
	return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Started = its day has come and, on the day itself, its start time has too.
// No start time counts as started from the top of the day.
function hasStarted(lab) {
	const day = isoDate(lab.date)
	const now = today()
	if (day < now) return true
	if (day > now) return false
	return !lab.startTime || nowHHMM() >= lab.startTime
}

function stageFor(lab) {
	if (lab.mine === 'attended') return lab.quizPassed ? 'lab' : 'quiz'
	const ended = isoDate(lab.date) < today()
	const holding = lab.mine === 'rsvped' || lab.mine === 'waitlisted' || lab.mine === 'offered'
	if (!ended && holding && hasStarted(lab)) return 'checkin'
	return 'signup'
}

export default function MemberLabView() {
	const id = useSearchParams().get('id')
	const [lab, setLab] = useState(null)
	const [error, setError] = useState(null)
	// bumped on a timer so the stage is re-worked out against the clock
	const [, setTick] = useState(0)

	const load = useCallback(async () => {
		try {
			setLab(await labsApi.get(id))
			setError(null)
		} catch (err) {
			setError(err.message)
		}
	}, [id])

	useEffect(() => {
		if (!id) return
		let live = true
		labsApi
			.get(id)
			.then((row) => live && setLab(row))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [id])

	useEffect(() => {
		const timer = setInterval(() => setTick((n) => n + 1), CLOCK_MS)
		return () => clearInterval(timer)
	}, [])

	const stage = lab ? stageFor(lab) : null

	useEffect(() => {
		if (stage !== 'checkin') return
		const timer = setInterval(load, CHECKIN_POLL_MS)
		return () => clearInterval(timer)
	}, [stage, load])

	let body = null
	if (!id) {
		body = <Message>No lab picked — head back to the labs page and choose one.</Message>
	} else if (error && !lab) {
		body = <Message>{error}</Message>
	} else if (stage === 'signup') {
		// centred, sitting a touch above the middle as the mockup does
		body = (
			<div className="
				lg:min-h-full
				flex
				flex-col
				justify-center
				lg:pb-[26px]
			">
				<Scaled className="
					lg:pl-[48px]
					lg:pr-[16px]
				">
					<MemberLabSignup
						lab={lab}
						ended={isoDate(lab.date) < today()}
						onChange={load}
					/>
				</Scaled>
			</div>
		)
	} else if (stage === 'checkin' || stage === 'quiz') {
		body = (
			<Scaled className="
				lg:pl-[40px]
				lg:pr-[27px]
				lg:pt-[25px]
			">
				<MemberLabQuiz
					lab={lab}
					checkedIn={stage === 'quiz'}
					// passing unlocks the content, which only a fresh read
					// brings back — the quiz answer doesn't carry it
					onPassed={load}
				/>
			</Scaled>
		)
	} else if (stage === 'lab') {
		// scales itself — it needs the zoom for its own measurements
		body = <MemberLabContent lab={lab} />
	}

	// Same bleed as the analytics pages: the scroll column is pulled out over
	// the shell's padding on the top, bottom and right, so the quiz scrolls from
	// the very top of the window to the very bottom instead of being cut off
	// 32px short of each edge. The padding puts the content back where it was,
	// so nothing on the page moves — only where it gets clipped.
	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:py-8
			lg:pr-8
		">
			<BackButton />
			{body}
		</DashboardShell>
	)
}

function Message({ children }) {
	return (
		<p className="
			font-vietnam
			text-[15px]
			text-black/[0.53]
			text-center
			mt-20
		">
			{children}
		</p>
	)
}
