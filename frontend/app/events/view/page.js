import { currentRole, hasRole } from '@/lib/roles'
import UserEventView from '@/components/events/MemberEventView'
import OfficerEventView from '@/components/events/OfficerEventView'

export default function EventView() {
	if (hasRole('officer', currentRole)) return <OfficerEventView />
	return <UserEventView />
}
