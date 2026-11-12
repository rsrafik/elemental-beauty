'use client'

import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import LandingEditor from '@/components/landingEditor/LandingEditor'

export default function LandingEditorPage() {
	return (
		<Gate
			require="admin"
			fallback={<NoAccess />}
			render={(user) => <LandingEditor user={user} />}
		/>
	)
}
