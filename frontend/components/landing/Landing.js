// The public landing page — set aside while the site is only for members
// (app/page.js sends / to /login instead). To bring it back, render this from
// app/page.js again.
//
// A Server Component, and nothing here needs the browser — it is ordinary flow
// content all the way down.

export default function Landing() {
	return (
		<main className="
			bg-cream
			text-orange-dark
		">
			<section
				id="about"
				className="
				flex
				min-h-screen
				flex-col
				items-center
				justify-center
				px-6
				text-center
			">
				<h2 className="
					font-reasons
					text-[64px]
					leading-none
					md:text-[96px]
				">
					elemental beauty
				</h2>
				<p className="
					font-handrawn
					mt-6
					max-w-[560px]
					text-[24px]
				">
					A club for people who make things with their hands.
				</p>
			</section>

			<section className="
				flex
				min-h-screen
				flex-col
				items-center
				justify-center
				bg-salmon-lightest
				px-6
				text-center
			">
				<h2 className="
					font-reasons
					text-[56px]
					leading-none
					md:text-[80px]
				">
					what we do
				</h2>
				<p className="
					font-handrawn
					mt-6
					max-w-[560px]
					text-[24px]
				">
					Workshops, labs, and a calendar you can actually keep up with.
				</p>
			</section>
		</main>
	)
}
