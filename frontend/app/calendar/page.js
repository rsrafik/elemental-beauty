import { currentRole, hasRole } from '@/lib/roles'
import UserCalendar from '@/components/calendar/MemberCalendar'
import OfficerCalendar from '@/components/calendar/OfficerCalendar'

export default function Calendar() {
	if (hasRole('officer', currentRole)) return <OfficerCalendar />
	return <UserCalendar />
}
