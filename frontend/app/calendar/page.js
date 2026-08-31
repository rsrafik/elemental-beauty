'use client'

import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserCalendar from '@/components/calendar/MemberCalendar'
import OfficerCalendar from '@/components/calendar/OfficerCalendar'

export default function Calendar() {
	return (
		<Gate
			require="member"
			fallback={<NoAccess message="The calendar is for members." />}
			render={(user) =>
				hasRole('officer', user.role) ? <OfficerCalendar /> : <UserCalendar />
			}
		/>
	)
}
