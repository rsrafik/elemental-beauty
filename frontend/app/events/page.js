import { currentRole, hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserEvents from '@/components/events/MemberEvents'
import OfficerEvents from '@/components/events/OfficerEvents'

export default function Events() {
	if (!hasRole('member', currentRole)) return <NoAccess message="Events are for members." />
	if (hasRole('officer', currentRole)) return <OfficerEvents />
	return <UserEvents />
}
