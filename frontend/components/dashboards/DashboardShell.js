import Sidebar from '@/components/dashboards/Sidebar'
import { currentRole } from '@/lib/roles'
import { navFor, showInstagramFor } from '@/lib/nav'

// Sidebar + content frame shared by every logged-in page that isn't the
// dashboard itself. The dashboards lay out their own <main> because each one
// has its own grid; everything else can just wrap its content in this.
//
//   <DashboardShell>
//     ...page content...
//   </DashboardShell>
//
// The sidebar figures out which item is active from the URL, so there's
// nothing to pass in for that.

export default function DashboardShell({
	children,
	showInstagram = showInstagramFor(currentRole),
	className = '',
}) {
	return (
		// Above `lg` this is a fixed-height two-column frame and the content
		// column is what scrolls. Below it the columns stack — menu bar on top,
		// content under it — and the page scrolls as a whole, because a
		// locked-height column inside a phone-sized window leaves nowhere to put
		// anything.
		<main className="
			bg-cream
			w-full
			min-h-screen
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
		">
			<Sidebar
				items={navFor(currentRole)}
				showInstagram={showInstagram}
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
