import { currentRole, hasRole } from '@/lib/roles'
import UserLabView from '@/components/labs/UserLabView'
import OfficerLabView from '@/components/labs/OfficerLabView'

export default function LabView() {
	if (hasRole('officer', currentRole)) return <OfficerLabView />
	return <UserLabView />
}
