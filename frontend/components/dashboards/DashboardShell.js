'use client'

import Sidebar from '@/components/dashboards/Sidebar'
import { useRole, useSignOut } from '@/lib/session'
import { navFor, showInstagramFor } from '@/lib/nav'

// Sidebar + content frame shared by every logged-in page that isn't the
// dashboard itself. The dashboards lay out their own <main> because each one
// has its own grid; everything else can just wrap its content in this.
//
//   <DashboardShell>
//     ...page content...
//   </DashboardShell>
//
// `fit` is for a page built to be exactly one screen tall on a phone — the
// member labs and events pages, whose panels size themselves to the window.
// Below `lg` it pins the page to the visible height and switches off page
// scrolling, so a swipe can't drag the panels up under the menu bar.
//
// `overflow-clip`, not `overflow-hidden`, to switch it off: hidden makes the
// page a scroll container, and a sticky child of a scroll container gets that
// container's padding added to its offset — the menu bar slid 16px down onto
// the gap under it. Clip hides the overflow without being one. The menu bar's
// place there (32px down, 48px from `sm`) is kept on purpose with the top
// padding instead; the pages' panels are sized to it (MemberLabs, MemberEvents).
//
// The sidebar figures out which item is active from the URL, so there's
// nothing to pass in for that. The menu it's given comes from the signed-in
// role, so it can't offer a page the API would then refuse.

export default function DashboardShell({
	children,
	showInstagram,
	fit = false,
	className = '',
}) {
	const role = useRole()
	const signOut = useSignOut()

	return (
		// Above `lg` this is a fixed-height two-column frame and the content
		// column is what scrolls. Below it the columns stack — menu bar on top,
		// content under it — and the page scrolls as a whole, because a
		// locked-height column inside a phone-sized window leaves nowhere to put
		// anything.
		//
		// `svh`/`dvh` rather than `screen` (100vh): on an iPhone 100vh is the
		// height with the browser's toolbars hidden, taller than what's actually
		// showing, so a page that claims it leaves a strip of empty cream to
		// scroll down into.
		<main className={`
			bg-cream
			w-full
			${fit ? 'h-dvh overflow-clip pt-8 sm:pt-12' : 'min-h-svh'}
			lg:h-screen
			overflow-x-clip
			lg:overflow-hidden
			p-4
			sm:p-6
			lg:p-8
			flex
			flex-col
			lg:flex-row
			gap-4
			lg:gap-6
		`}>
			<Sidebar
				items={navFor(role)}
				showInstagram={showInstagram ?? showInstagramFor(role)}
				onLogout={signOut}
			/>

			{/* page-enter / page-stagger are the entrance (see globals.css): the
			    column drifts up as one plane and whatever sits directly inside it
			    rises in sequence, so arriving on a page reads as movement instead
			    of a swap. The sidebar deliberately has none — it's the thing that
			    stays put while the page changes behind it. */}
			<section className={`
				page-enter
				page-stagger
				flex-1
				min-w-0
				lg:overflow-y-auto
				${className}
			`}>
				{children}
			</section>
		</main>
	)
}
