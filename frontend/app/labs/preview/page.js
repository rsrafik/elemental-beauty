'use client'

import { Suspense } from 'react'
import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import MemberLabPreview from '@/components/labs/MemberLabPreview'

// /labs/preview?id=N — a lab as a member sees it, for staff. Members get the
// real thing on /labs/view once they've passed the quiz.
export default function PreviewLab() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<Gate
				require="officer"
				fallback={<NoAccess message="Lab previews are for e-board." />}
				render={() => <MemberLabPreview />}
			/>
		</Suspense>
	)
}
