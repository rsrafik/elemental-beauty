'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import LabEditor from '@/components/labs/LabEditor'

// /labs/edit for a new lab, /labs/edit?id=N for an existing one. Officers only.
function EditRoute() {
	const id = useSearchParams().get('id')
	return (
		<Gate
			require="officer"
			fallback={<NoAccess message="Only officers can edit labs." />}
			render={() => <LabEditor id={id} />}
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
