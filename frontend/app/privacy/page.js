import Link from 'next/link'

// The privacy policy, open to everyone (no Gate). Google asks for one before
// the club's Gmail can be used to send the dashboard's "Email all" (see
// src/email.js), and it's what anyone signing up should be able to read
// anyway. Keep it in step with what the site actually stores.

export const metadata = {
	title: 'Privacy policy · Elemental Beauty',
}

const UPDATED = 'November 8, 2026'

const SECTIONS = [
	{
		heading: 'What we keep',
		items: [
			'Your account: name, email address, username and a scrambled (hashed) copy of your password. We never see or keep the password itself.',
			'What you add to your profile, if you choose to: a profile picture, Instagram and Discord handles.',
			'Your membership: your role, points, the labs and events you sign up for and attend, and your quiz answers.',
			'The waiver: the name you typed to sign it and when.',
			'Payments you send in for dues, fees or goggle rentals: the amount, the method, the reference you give, and a screenshot if you attach one. We don’t take card or bank details. You pay through one of the club’s payment methods shown on the site and tell us about it here.',
			'Your email choices, like whether you get club-wide emails.',
			'A record of club activity on the site (who signed up for what, who changed what), so officers can follow what happened.',
		],
	},
	{
		heading: 'Why',
		items: [
			'To run the club: sign-ups, check-in, points, dues and the calendar.',
			'To email you about your account (confirming your address, resetting your password), about labs and events you’ve signed up for, and club-wide news unless you turn that off on your account page.',
		],
	},
	{
		heading: 'Who sees it',
		items: [
			'Club officers and staff see what they need for their role: for example, the roster and sign-ups for officers, and payments for the treasurer.',
			'Other members can see your name and profile picture where you show up together, like a lab’s sign-up list.',
			'We don’t sell your information, show ads, or use tracking or analytics services.',
		],
	},
	{
		heading: 'Services we use',
		items: [
			'Render hosts the site and its database.',
			'Resend and Gmail send the club’s emails. Gmail is used only to send email from the club’s own Google account; the site doesn’t read that inbox or anything else in it.',
			'Cloudflare sits in front of the site to keep it fast and safe.',
		],
	},
	{
		heading: 'On your device',
		items: [
			'When you sign in, your browser keeps a sign-in token so you stay signed in. Signing out removes it. We don’t use advertising or tracking cookies.',
		],
	},
	{
		heading: 'Your choices',
		items: [
			'You can change your profile and email choices on your account page.',
			'To see what we have about you, fix it, or have your account deleted, email us at the address below.',
		],
	},
]

export default function Privacy() {
	return (
		<main className="
			min-h-screen
			w-full
			bg-cream
			flex
			justify-center
			px-4
			py-10
			sm:py-16
		">
			<article className="
				page-enter
				w-full
				max-w-[720px]
				rounded-[26px]
				bg-white
				p-7
				sm:p-12
				shadow-[0_0_20px_rgba(0,0,0,0.12)]
				text-black
			">
				<h1 className="
					font-beachday
					text-[34px]
					sm:text-[46px]
					leading-none
				">
					privacy policy
				</h1>
				<p className="mt-3 text-[14px] text-black/60">
					Elemental Beauty · last updated {UPDATED}
				</p>
				<p className="mt-6 text-[16px] leading-relaxed">
					Elemental Beauty is a student club at Purdue University. This page explains what
					elementalbeauty.org keeps about you, why, and who can see it.
				</p>

				{SECTIONS.map((section) => (
					<section key={section.heading} className="mt-8">
						<h2 className="text-[20px] font-semibold">{section.heading}</h2>
						<ul className="mt-3 list-disc pl-5 space-y-2 text-[16px] leading-relaxed">
							{section.items.map((item) => <li key={item}>{item}</li>)}
						</ul>
					</section>
				))}

				<section className="mt-8">
					<h2 className="text-[20px] font-semibold">Contact</h2>
					<p className="mt-3 text-[16px] leading-relaxed">
						Questions, or want your information changed or deleted? Email{' '}
						<a className="underline" href="mailto:elementalbeauty26@gmail.com">elementalbeauty26@gmail.com</a>.
						If this policy changes, we’ll update the date at the top.
					</p>
				</section>

				<p className="mt-10 text-[15px]">
					<Link className="underline" href="/login">Back to the site</Link>
				</p>
			</article>
		</main>
	)
}
