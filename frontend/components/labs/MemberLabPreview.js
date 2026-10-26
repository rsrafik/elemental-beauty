'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { labs as labsApi } from '@/lib/api'
import { BackButton } from '@/components/labs/LabViewParts'
import MemberLabContent from '@/components/labs/MemberLabContent'

// /labs/preview?id=N: the lab as a member sees it once they're through the
// quiz — materials, lesson, instructions — for the advisor, from "preview lab"
// in the card's dots menu on /labs. The same view the lab editor's eye shows,
// but of what's saved rather than what's in the form. Staff get the whole lab
// off GET /api/labs/:id, so there's nothing to unlock.
export default function MemberLabPreview() {
	const id = useSearchParams().get('id')
	const [lab, setLab] = useState(null)
	const [error, setError] = useState(null)

	useEffect(() => {
		if (!id) return
		let live = true
		labsApi
			.get(id)
			.then((row) => live && setLab(row))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [id])

	let body = null
	if (!id) body = <Message>No lab picked. Head back to the labs page and choose one.</Message>
	else if (error) body = <Message>{error}</Message>
	else if (lab) body = <MemberLabContent lab={lab} />

	// the member page's own frame (see MemberLabView)
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
