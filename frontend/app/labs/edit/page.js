'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import LabAccessGuard from '@/components/labs/LabAccessGuard'
import LabEditor from '@/components/labs/LabEditor'

// /labs/edit?new=1 for a new lab (NEW_LAB in lib/openNew.js says why it isn't
// a bare /labs/edit), /labs/edit?id=N for an existing one. Officers only.
function EditRoute() {
	const id = useSearchParams().get('id')
	return (
		<Gate
			require="officer"
			fallback={<NoAccess message="Only e-board can edit labs." />}
			render={() => <LabAccessGuard id={id}><LabEditor id={id} /></LabAccessGuard>}
		/>
	)
}

export default function EditLab() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<EditRoute />
		</Suspense>
	)
}
