import { currentRole, hasRole } from '@/lib/roles'
import UserCalendar from '@/components/calendar/UserCalendar'
import OfficerCalendar from '@/components/calendar/OfficerCalendar'

export default function Calendar() {
	if (hasRole('officer', currentRole)) return <OfficerCalendar />
	return <UserCalendar />
}
