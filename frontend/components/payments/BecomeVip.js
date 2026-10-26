'use client'

import DashboardShell from '@/components/dashboards/DashboardShell'
import PaySection from '@/components/payments/PaySection'
import { Scaled } from '@/components/labs/LabViewParts'
import { useDuesPaid, useRole } from '@/lib/session'

// /vip — "become VIP" in a plain member's sidebar: everything a lab's page
// offers for paying ahead, with what it's for fixed to the year's VIP dues
// (PaySection's duesOnly). Once the treasurer approves it they're a VIP, the
// sidebar entry goes, and this page says so.
//
// Zoomed to the window the way a lab's page is (Scaled), so on a big screen
// it fills the column instead of sitting small in a field of cream.

export default function BecomeVip() {
	const role = useRole()
	const duesPaid = useDuesPaid()
	// j-board who've paid are VIPs too, keeping their role
	const vip = role === 'vip' || duesPaid
	return (
		<DashboardShell className="
			flex
			flex-col
		">
			<Scaled className="
				my-auto
				w-full
				max-w-[720px]
				mx-auto
				py-10
			">
				<h1 className="
					font-beachday
					text-[48px]
					sm:text-[64px]
					leading-[1.05]
					text-salmon
					text-center
				">
					become a VIP
				</h1>
				<p className="
					mt-3
					font-vietnam
					text-[16px]
					leading-[1.45]
					text-black/70
					text-center
				">
					{vip
						? 'You’re a VIP! Every lab and members-only event is covered this year.'
						: 'Pay your dues for the semester and every lab and members-only event is covered, with no entry fee at the door. Pay with one of the codes below, then tell us how you paid and the transaction id.'}
				</p>
				<PaySection duesOnly />
			</Scaled>
		</DashboardShell>
	)
}
