'use client'

import { useEffect, useState } from 'react'
import NoAccess from '@/components/NoAccess'
import { labs as labsApi } from '@/lib/api'
import { canEditLab, canManageLabs } from '@/lib/roles'
import { useSession } from '@/lib/session'

// Around the lab and quiz editors. Officers, the treasurer and admin go
// straight through. J-board gets in only to a lab that's been opened to them
// ("allow j-board to edit", in its dots menu on /labs) — never a new one, since
// adding labs is for officers and up. The API refuses the rest regardless
// (mayEditLab in src/routes/labRoutes.js).
export default function LabAccessGuard({ id, children }) {
	const { user } = useSession()
	const manages = canManageLabs(user)
	const asks = !manages && Boolean(id)
	// null while asking
	const [allowed, setAllowed] = useState(manages ? true : asks ? null : false)

	useEffect(() => {
		if (!asks) return
		let live = true
		labsApi
			.get(id)
			.then((lab) => live && setAllowed(canEditLab(user, lab)))
			.catch(() => live && setAllowed(false))
		return () => { live = false }
	}, [asks, id, user])

	if (allowed === null) return null
	if (!allowed) {
		return (
			<NoAccess message={id
				? 'J-board can edit this lab once an officer allows it from its menu.'
				: 'Only officers, the treasurer and admins add labs.'} />
		)
	}
	return children
}
