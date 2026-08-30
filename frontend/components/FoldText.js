'use client'

import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Text that unfolds into place — every piece starts rotated flat on a hinge and
// swings down to face you, one after the next.
//
// The 3D is per piece, not per line: each segment carries its own `perspective`
// so a character at the end of a word folds on the same axis as one at the
// start, rather than being viewed from further off to the side. A single
// perspective on the wrapper would fan the row out like a hand of cards.
//
// The crease is a gradient laid over each piece with `mix-blend-mode: multiply`,
// held at `--fold-crease` while the piece is edge-on and taken to 0 as it lands.
// That is what sells it as paper rather than as type on a turntable — a fold
// catches shadow along its hinge and loses it as it flattens.
//
// The styles live in globals.css with the rest of this project's animation CSS,
// rather than in a <style> tag inside the component: one copy however many
// times this renders, and no metadata element sitting inside a heading.
//
// Typography is inherited, not imposed. Size, weight and colour come through
// the props if you set them, and line-height and letter-spacing always come
// from whatever this is wrapping — the point is to animate a heading that is
// already styled, not to restyle it.

const HINGE_CONFIG = {
	top: { origin: '50% 0%', rotateX: -92, rotateY: 0 },
	bottom: { origin: '50% 100%', rotateX: 92, rotateY: 0 },
	left: { origin: '0% 50%', rotateX: 0, rotateY: 92 },
	right: { origin: '100% 50%', rotateX: 0, rotateY: -92 }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const renderWhitespace = (value, key) =>
	value.split(/(\n)/).map((part, index) => {
		if (part === '\n') return <br key={`${key}-br-${index}`} />
		if (!part) return null

		return (
			<span className="fold-text-whitespace" key={`${key}-space-${index}`}>
				{part.replace(/ /g, ' ')}
			</span>
		)
	})

const FoldText = ({
	text = 'Design unfolds',
	splitBy = 'char',
	hinge = 'top',
	duration = 0.65,
	stagger = 0.045,
	ease = 'power3.out',
	perspective = 700,
	creaseShading = 0.55,
	trigger = 'mount',
	fontSize,
	fontWeight,
	color,
	className = '',
	style = {}
}) => {
	const rootRef = useRef(null)
	const timelineRef = useRef(null)
	const hingeConfig = HINGE_CONFIG[hinge] || HINGE_CONFIG.top
	const safeCrease = clamp(creaseShading, 0, 1)
	const safePerspective = Math.max(120, perspective)

	const segments = useMemo(() => {
		let segmentIndex = 0

		const renderSegment = (content, key, split = splitBy) => {
			segmentIndex += 1
			return (
				<span
					className="fold-text-segment"
					data-fold-split={split}
					key={key}
					style={{ '--fold-perspective': `${safePerspective}px` }}
				>
					<span
						className="fold-text-piece"
						data-fold-hinge={hinge}
						style={{ transformOrigin: hingeConfig.origin, '--fold-crease': 0 }}
					>
						{content || ' '}
					</span>
				</span>
			)
		}

		if (splitBy === 'line') {
			return text.split('\n').map((line, index) => (
				<span className="fold-text-line" key={`line-${index}`}>
					{renderSegment(line || ' ', `segment-line-${index}`, 'line')}
				</span>
			))
		}

		if (splitBy === 'word') {
			return text.split(/(\s+)/).flatMap((part, index) => {
				if (!part) return []
				if (/^\s+$/.test(part)) return renderWhitespace(part, `ws-${index}`)
				return renderSegment(part, `segment-word-${segmentIndex}`)
			})
		}

		return Array.from(text).map((char, index) => {
			if (char === '\n') return <br key={`br-${index}`} />
			return renderSegment(char === ' ' ? ' ' : char, `segment-char-${index}`)
		})
	}, [text, splitBy, hinge, hingeConfig.origin, safePerspective])

	useEffect(() => {
		if (typeof window === 'undefined') return undefined

		const root = rootRef.current
		if (!root) return undefined

		const pieces = Array.from(root.querySelectorAll('.fold-text-piece'))
		if (!pieces.length) return undefined

		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		const activeDuration = reduceMotion ? Math.min(duration, 0.22) : duration
		const activeStagger = reduceMotion ? Math.min(stagger, 0.02) : stagger
		const fromVars = {
			opacity: 0,
			rotateX: reduceMotion ? 0 : hingeConfig.rotateX,
			rotateY: reduceMotion ? 0 : hingeConfig.rotateY,
			'--fold-crease': reduceMotion ? 0 : safeCrease,
			transformOrigin: hingeConfig.origin,
			force3D: true
		}
		const toVars = {
			opacity: 1,
			rotateX: 0,
			rotateY: 0,
			'--fold-crease': 0,
			duration: activeDuration,
			ease: reduceMotion ? 'power1.out' : ease,
			stagger: activeStagger,
			clearProps: 'willChange'
		}

		const killTimeline = () => {
			timelineRef.current?.kill()
			timelineRef.current = null
			gsap.killTweensOf(pieces)
		}

		const play = repeat => {
			killTimeline()
			timelineRef.current = gsap.timeline({ repeat: repeat ? -1 : 0, repeatDelay: repeat ? 0.75 : 0 })
			timelineRef.current.fromTo(pieces, fromVars, toVars)
			return timelineRef.current
		}

		let scrollTrigger
		let hoverHandler

		if (trigger === 'hover') {
			gsap.set(pieces, { opacity: 1, rotateX: 0, rotateY: 0, '--fold-crease': 0, transformOrigin: hingeConfig.origin })
			hoverHandler = () => play(false)
			root.addEventListener('mouseenter', hoverHandler)
		} else if (trigger === 'scroll') {
			// Registered here rather than at module scope: the plugin touches
			// window on load, and this file is imported by a server render first.
			gsap.registerPlugin(ScrollTrigger)
			gsap.set(pieces, fromVars)
			scrollTrigger = ScrollTrigger.create({
				trigger: root,
				start: 'top 82%',
				once: true,
				onEnter: () => play(false)
			})
		} else if (trigger === 'loop') {
			play(true)
		} else {
			play(false)
		}

		return () => {
			if (hoverHandler) root.removeEventListener('mouseenter', hoverHandler)
			scrollTrigger?.kill()
			killTimeline()
		}
	}, [
		text,
		splitBy,
		hinge,
		duration,
		stagger,
		ease,
		perspective,
		safeCrease,
		trigger,
		hingeConfig.origin,
		hingeConfig.rotateX,
		hingeConfig.rotateY
	])

	// Only set what was actually passed. Writing `--fold-text-font-size: undefined`
	// is harmless, but writing a default here would quietly override the type
	// this is wrapping.
	const rootStyle = { ...style }
	if (fontSize !== undefined) {
		rootStyle['--fold-text-font-size'] = typeof fontSize === 'number' ? `${fontSize}px` : fontSize
	}
	if (fontWeight !== undefined) rootStyle['--fold-text-font-weight'] = fontWeight
	if (color !== undefined) rootStyle['--fold-text-color'] = color

	return (
		<span ref={rootRef} className={`fold-text ${className}`.trim()} style={rootStyle}>
			<span className="fold-text-sr-only">{text}</span>
			<span className="fold-text-visual" aria-hidden="true">
				{segments}
			</span>
		</span>
	)
}

export default FoldText
