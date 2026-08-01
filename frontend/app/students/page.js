import { currentRole, hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import OfficerStudents from '@/components/students/OfficerStudents'

export default function Students() {
	if (!hasRole('officer', currentRole)) return <NoAccess />
	return <OfficerStudents />
}
