import { currentRole, hasRole } from '@/lib/roles'
import UserEvents from '@/components/events/UserEvents'
import OfficerEvents from '@/components/events/OfficerEvents'

export default function Events() {
	if (hasRole('officer', currentRole)) return <OfficerEvents />
	return <UserEvents />
}
