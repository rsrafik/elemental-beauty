'use client'

import { Gate } from '@/lib/session'
import Profile from '@/components/account/Profile'

// /account — reached from the profile button at the bottom of the sidebar.
// One page for every role: the parts that only make sense for somebody with a
// member row (stats, standing) are gated inside the component.

export default function Account() {
	return <Gate render={() => <Profile />} />
}
