import ScrollSequence from '@/components/home/ScrollSequence'

// The landing page stays a Server Component — only the sequence needs the
// browser, so only the sequence ships as a client bundle. Everything below it
// is ordinary flow content: ScrollTrigger's pin spacer reserves the scroll the
// sequence consumes, so these sections arrive on their own with no offsets to
// compensate for and no knowledge that the pin above them exists.

export default function Home() {
	return (
		<main className="
			bg-cream
			text-orange-dark
		">
			<ScrollSequence />

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
