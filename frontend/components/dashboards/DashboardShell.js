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
		<main className="
			bg-cream
			w-full
			h-screen
			overflow-hidden
			p-8
			flex
			gap-6
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
				overflow-y-auto
				${className}
			`}>
				{children}
			</section>
		</main>
	)
}
