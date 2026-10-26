'use client'

import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import BecomeVip from '@/components/payments/BecomeVip'

export default function Vip() {
	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Becoming a VIP is for members." />}
			render={() => <BecomeVip />}
		/>
	)
}
