import { currentRole, hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserCalendar from '@/components/calendar/MemberCalendar'
import OfficerCalendar from '@/components/calendar/OfficerCalendar'

export default function Calendar() {
	if (!hasRole('member', currentRole)) return <NoAccess message="The calendar is for members." />
	if (hasRole('officer', currentRole)) return <OfficerCalendar />
	return <UserCalendar />
}
