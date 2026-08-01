import { currentRole, hasRole } from '@/lib/roles'
import UserLabs from '@/components/labs/MemberLabs'
import OfficerLabs from '@/components/labs/OfficerLabs'

export default function Labs() {
	if (hasRole('officer', currentRole)) return <OfficerLabs />
	return <UserLabs />
}
