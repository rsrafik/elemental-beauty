'use client'

import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import OfficerStudents from '@/components/students/OfficerStudents'

export default function Students() {
	return (
		<Gate
			require="officer"
			fallback={<NoAccess />}
			render={() => <OfficerStudents />}
		/>
	)
}
