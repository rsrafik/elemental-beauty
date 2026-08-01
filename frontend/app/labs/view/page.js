import { currentRole, hasRole } from '@/lib/roles'
import UserLabView from '@/components/labs/MemberLabView'
import OfficerLabView from '@/components/labs/OfficerLabView'

export default function LabView() {
	if (hasRole('officer', currentRole)) return <OfficerLabView />
	return <UserLabView />
}
