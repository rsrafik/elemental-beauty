'use client'

import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import Sponsors from '@/components/sponsors/Sponsors'

export default function SponsorsPage() {
	return (
		<Gate
			require="admin"
			fallback={<NoAccess />}
			render={(user) => <Sponsors user={user} />}
		/>
	)
}
