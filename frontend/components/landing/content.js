// Every word and every placeholder on the landing page, in one place, so the
// copy can be edited without reading through the components.
//
// What is real: the club's name, that it is Purdue's cosmetic science club,
// the coordinates, the contact address, the Instagram and Discord links, and
// the things the site itself does (labs with lessons and quizzes, events on a
// calendar, points, the leaderboard, the Elementist pass).
//
// What is a draft: the sentences. They were written from the above and nobody
// at the club has signed them off yet.
//
// What is a placeholder: every person, sponsor and album photo. Search for
// PLACEHOLDER to find them.

export const CLUB = {
	name: 'Elemental Beauty',
	email: 'elementalbeauty26@gmail.com',
	instagram: 'https://instagram.com/elementist_',
	discord: 'https://discord.gg/G4Nmc9fsh3',
	coordinates: '40.4237° N — 86.9212° W',
	place: 'Purdue University, West Lafayette, IN',
}

export const NAV = [
	{ id: 'who', label: 'who' },
	{ id: 'what', label: 'what' },
	{ id: 'album', label: 'album' },
	{ id: 'sponsors', label: 'sponsors' },
]

export const HERO = {
	tagline: ['Purdue’s cosmetic science club. We make the things on your bathroom shelf, and learn ', 'why', ' they work.'],
	// written the way the back of a bottle lists what is in it
	ingredients:
		'Ingredients: Aqua (curiosity), Glycerin, Cetearyl Alcohol, Friends, Tocopherol, Good Lighting, Parfum.',
	cta: 'Become an Elementist',
}

// The statement is revealed a word at a time. A word wrapped in *stars* is set
// in the italic and picks up a pigment.
export const WHO = {
	title: 'who we are',
	statement:
		'We are students who would rather *make* the moisturiser than just buy it. Chemists, engineers, artists and the simply *curious*, at one bench, turning oil and water into something that *holds*.',
}

// PLACEHOLDER: stand-in people, and the roles are guesses. Give each one a
// `name` (it replaces the role on the rail, and the role moves to the label on
// their portrait), a `src` (a file in public/, e.g. '/team/president.jpg',
// taller than wide) and a line or two of `text`. `shade` is the colour of the
// stand-in swatch; `tilt` is how many degrees their
// portrait leans.
export const TEAM = {
	title: 'the people',
	people: [
		{ role: 'President', shade: 'salmon', tilt: 5, text: 'A line or two about this person goes here: what they study, and the thing they most like to make.' },
		{ role: 'Lab lead', shade: 'lilac', tilt: -6, text: 'A line or two about this person goes here: what they study, and the thing they most like to make.' },
		{ role: 'Treasurer', shade: 'green', tilt: 6, text: 'A line or two about this person goes here: what they study, and the thing they most like to make.' },
		{ role: 'Events', shade: 'yellow', tilt: -4, text: 'A line or two about this person goes here: what they study, and the thing they most like to make.' },
		{ role: 'Outreach', shade: 'serum', tilt: 4, text: 'A line or two about this person goes here: what they study, and the thing they most like to make.' },
	],
}

export const WHAT = {
	title: 'what we do',
	intro: 'Four swatches of what a semester here is made of.',
	tiles: [
		{
			key: 'labs',
			title: 'labs',
			body: 'Hands-on formulation labs. Weigh, heat, mix and pour, with the goggles on.',
		},
		{
			key: 'events',
			title: 'events',
			body: 'Speakers, socials and nights out of the lab, all on one calendar.',
		},
		{
			key: 'learn',
			title: 'learn',
			body: 'Every lab comes with a lesson and a quiz, so you know why the formula holds.',
		},
		{
			key: 'points',
			title: 'points',
			body: 'Show up, earn points, climb the leaderboard. Your Elementist pass keeps count.',
		},
	],
}

// PLACEHOLDER: nine stand-in cards. Give each one a `src` (a file in public/,
// e.g. '/album/fall-callout.jpg'), a real `title`, a `date` and a line or two
// of `text`, and the card shows the photo instead of its swatch. `shade` is
// only the colour of the stand-in swatch.
export const ALBUM = {
	title: 'the album',
	intro: 'Every event is a shade. Fan the deck, pull a card.',
	photos: [
		{ shade: 'salmon', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'yellow', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'green', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'lilac', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'orange', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'berry', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'serum', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'blue', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
		{ shade: 'salmon', title: 'Your event here', date: 'date', text: 'A line or two about the event goes here: what was made, and who came.' },
	],
}

// PLACEHOLDER: stand-in sponsors. Give each one a `name`, and a `logo` (a file
// in public/, e.g. '/sponsors/acme.svg') to show the logo instead of the name.
export const SPONSORS = {
	intro: 'An emulsion needs something to hold it together. So does a club.',
	cta: 'Sponsor a batch',
	rows: [
		[{ name: 'Your logo here' }, { name: 'Sponsor 02' }, { name: 'Sponsor 03' }, { name: 'Sponsor 04' }, { name: 'Sponsor 05' }],
		[{ name: 'Sponsor 06' }, { name: 'Sponsor 07' }, { name: 'Your logo here' }, { name: 'Sponsor 09' }, { name: 'Sponsor 10' }],
	],
}
