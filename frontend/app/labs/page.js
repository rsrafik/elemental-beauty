import { currentRole, hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserLabs from '@/components/labs/MemberLabs'
import OfficerLabs from '@/components/labs/OfficerLabs'

export default function Labs() {
	if (!hasRole('member', currentRole)) return <NoAccess message="Labs are for members." />
	if (hasRole('officer', currentRole)) return <OfficerLabs />
	return <UserLabs />
}
