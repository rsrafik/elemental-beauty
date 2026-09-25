'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import QuizEditor from '@/components/labs/QuizEditor'

// /labs/quiz?id=N — the lab's quiz editor. Officers only.
function QuizRoute() {
	const id = useSearchParams().get('id')
	return (
		<Gate
			require="officer"
			fallback={<NoAccess message="Only officers can edit lab quizzes." />}
			render={() => <QuizEditor id={id} />}
		/>
	)
}

export default function EditLabQuiz() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<QuizRoute />
		</Suspense>
	)
}
