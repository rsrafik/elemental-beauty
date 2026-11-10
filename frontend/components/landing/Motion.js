'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { SplitText } from 'gsap/SplitText'

// Everything on the landing page that a script has to move, in one place. The
// sections are plain markup; this reads the attributes they carry and
// animates them, so a section with no script still shows all of itself.
// (Things simply rising into view as they are scrolled to are not here: that
// is `data-rise`, and it is CSS alone, in app/landing.css.)
//
//   data-title   a headline: its words come up one after another
//   data-words   a sentence that inks in a word at a time as it is scrolled
//
// and the scenes that belong to one section each: the hero's opening, the
// swatches being swiped in (What.js) and the album's deck arriving (Album.js).
//
// When the name has landed it announces `lp:hero-settled`, which is the hero
// canvas's cue to start drawing the letters itself (Emulsion.js).
//
// It also makes every link to a place on this page glide there on the page's
// own curve, instead of jumping.
//
// The curves are the theme's (globals.css), registered here under the same
// names so a tween and a CSS transition can share one: mech, spring, expo.
// Nothing uses GSAP's default ease.
//
// Only transforms, opacity and clip paths are animated, never layout and
// never an SVG stroke, so every frame is something the compositor can do on
// its own.
//
// With reduced motion none of this runs except the links, which then jump:
// the preloader is dismissed, the page is marked ready, and everything is
// simply where it belongs.

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, CustomEase, SplitText)

export default function Motion() {
	useEffect(() => {
		const root = document.querySelector('.landing')
		if (!root) return

		CustomEase.create('mech', '0.85,0,0.15,1')
		CustomEase.create('spring', '0.34,1.56,0.64,1')
		CustomEase.create('expo', '0.16,1,0.3,1')
		gsap.defaults({ ease: 'expo' })

		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const preloader = root.querySelector('.lp-preloader')
		const settle = () => {
			document.documentElement.dataset.lpHero = 'settled'
			window.dispatchEvent(new Event('lp:hero-settled'))
		}

		// ---- links to places on this page ----
		// The navigation handles its own (it has a menu to close first) and
		// marks the event as dealt with; everything else lands here.
		const onClick = (event) => {
			const link = event.target.closest?.('a[href^="#"]')
			if (!link || event.defaultPrevented) return
			const target = document.getElementById(link.getAttribute('href').slice(1))
			if (!target) return
			event.preventDefault()
			gsap.to(window, {
				scrollTo: { y: target, autoKill: true },
				// further is slower, but never a crawl
				duration: still ? 0 : gsap.utils.clamp(0.9, 2.2, Math.abs(target.getBoundingClientRect().top) / 2600),
				ease: 'mech',
			})
		}
		root.addEventListener('click', onClick)

		if (still) {
			if (preloader) preloader.style.display = 'none'
			root.setAttribute('data-ready', '')
			document.fonts.ready.then(settle)
			return () => {
				root.removeEventListener('click', onClick)
				root.removeAttribute('data-ready')
				delete document.documentElement.dataset.lpHero
			}
		}

		root.setAttribute('data-motion', '')

		const context = gsap.context(() => {
			// ---- the opening ----
			const count = preloader?.querySelector('[data-count]')
			const pieces = root.querySelectorAll('.lp-wordmark .lp-ch')
			const lines = root.querySelectorAll('.lp-wordmark [data-line]')
			const heroRise = root.querySelectorAll('#top [data-rise]')
			const progress = { value: 0 }

			// the script is here, so the CSS fallback that would dismiss the
			// preloader on its own is no longer needed
			if (preloader) preloader.style.animation = 'none'

			// the pieces of the name come up from behind the foot of their line;
			// the clip is generous on the other three sides because the written
			// word's strokes reach well outside its line box
			gsap.set(lines, { clipPath: 'inset(-60% -10% -8% -10%)' })
			gsap.set(pieces, { yPercent: 125, rotate: 6 })
			gsap.set(heroRise, { opacity: 0, y: 28 })

			let fontsIn = false
			const opening = gsap.timeline()

			if (preloader) {
				opening.to(progress, {
					value: 100,
					duration: 1.7,
					ease: 'mech',
					onUpdate() {
						if (count) count.textContent = String(Math.round(progress.value)).padStart(2, '0')
						preloader.style.setProperty('--fill', String(progress.value / 100))
					},
				})
				// hold at 100 until the faces are in, so the name never arrives
				// in a fallback font
				opening.addPause('+=0.05', () => {
					if (fontsIn) opening.play()
				})
				opening.to(preloader, { clipPath: 'inset(0 0 100% 0)', duration: 0.95, ease: 'mech' })
				opening.set(preloader, { visibility: 'hidden' })
			}

			opening
				.add(() => root.setAttribute('data-ready', ''), preloader ? '-=0.8' : 0)
				.to(pieces, { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.06 }, preloader ? '-=0.6' : 0)
				.to(heroRise, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09 }, '-=1')
				.set(lines, { clearProps: 'clipPath' })
				.add(settle)

			document.fonts.ready.then(() => {
				fontsIn = true
				if (opening.paused()) opening.play()
			})

			// ---- headlines ----
			// By the word, never the letter: a script's letters join, and
			// splitting them apart would break the joins.
			gsap.utils.toArray('[data-title]', root).forEach((title) => {
				const split = SplitText.create(title, { type: 'words' })
				gsap.from(split.words, {
					yPercent: 55,
					rotate: 5,
					opacity: 0,
					duration: 1.2,
					stagger: 0.1,
					scrollTrigger: { trigger: title, start: 'top 90%', once: true },
				})
			})

			// ---- the statement, a word at a time ----
			gsap.utils.toArray('[data-words]', root).forEach((sentence) => {
				gsap.fromTo(
					sentence.querySelectorAll('[data-word]'),
					{ opacity: 0.12 },
					{
						opacity: 1,
						ease: 'none',
						stagger: 0.12,
						scrollTrigger: { trigger: sentence, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 },
					},
				)
			})

			// ---- the swatches ----
			// a row is on while it sits in the middle band of the window; the
			// stylesheet does the swipe
			gsap.utils.toArray('[data-swatch-row]', root).forEach((row) => {
				ScrollTrigger.create({ trigger: row, start: 'top 66%', end: 'bottom 34%', toggleClass: 'is-on' })
			})

			// ---- the album's deck arriving ----
			// It starts as a stack on the leftmost card's place and tilt, a
			// card's height down that tilt, where the next section hides most
			// of it. Scrolling into the section slides the stack up along the
			// tilt and, a beat behind, opens it out clockwise into the fan. Both
			// are numbers the stylesheet turns into each card's transform
			// (--drop and --fan, app/landing.css), and both follow the scroll,
			// so scrolling back up folds the deck away again.
			//
			// `data-entering` stays on the deck until the fan is fully open: it
			// turns the cards' own transitions off, so nothing else is trying
			// to move them while the scroll is.
			const deck = root.querySelector('[data-deck]')
			if (deck) {
				deck.setAttribute('data-entering', '')
				gsap
					.timeline({
						scrollTrigger: { trigger: deck, start: 'top 96%', end: 'top 36%', scrub: 0.7 },
						onUpdate() {
							deck.toggleAttribute('data-entering', this.progress() < 1)
						},
					})
					.fromTo(deck, { '--drop': 96 }, { '--drop': 0, duration: 0.85, ease: 'power2.out' }, 0)
					.fromTo(deck, { '--fan': 0 }, { '--fan': 1, duration: 0.85, ease: 'sine.inOut' }, 0.15)
			}
		}, root)

		return () => {
			context.revert()
			const arrived = root.querySelector('[data-deck]')
			arrived?.removeAttribute('data-entering')
			arrived?.style.removeProperty('--fan')
			arrived?.style.removeProperty('--drop')
			root.removeEventListener('click', onClick)
			root.removeAttribute('data-motion')
			root.removeAttribute('data-ready')
			delete document.documentElement.dataset.lpHero
		}
	}, [])

	return null
}
