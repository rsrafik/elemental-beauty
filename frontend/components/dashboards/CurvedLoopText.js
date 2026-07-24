'use client'

import { useEffect, useId, useRef, useState } from 'react'

// Text flowed along an arc, the way Framer's "Curved Loop Text" works.
// CSS can't bend text, so the curve is an SVG <path> and <textPath> rides it.
// Tailwind still handles the styling — fill-*, font-*, text-*, tracking-*.
//
//   curve   how far the arc bows upward. Higher = rounder, 0 = flat.
//           Negative bows downward (a frown instead of an arch).
//   speed   seconds for the band to advance by one copy of `text`.
//           Lower is faster. 0 leaves it static.
//   overrun how far past each end of the visible box the path runs, in
//           viewBox units — this is the part that hides behind the cards.
export default function CurvedLoopText({
    text = 'POINTS',
    curve = 120,
    speed = 10,
    overrun = 100,
    className = '',
}) {
    const id = useId()
    const pathRef = useRef(null)
    const rulerRef = useRef(null)

    // Measured after mount, because both numbers depend on the rendered font.
    const [loop, setLoop] = useState(null)

    const phrase = `${text} · `

    useEffect(() => {
        let cancelled = false

        // Wait for the webfont — measuring against the fallback gives a phrase
        // width that's wrong by enough to make the loop visibly stutter.
        document.fonts.ready.then(() => {
            if (cancelled || !pathRef.current || !rulerRef.current) return

            const pathLength = pathRef.current.getTotalLength()
            const phraseLength = rulerRef.current.getComputedTextLength()
            if (!pathLength || !phraseLength) return

            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

            setLoop({
                // One spare copy beyond what covers the path, so there's always
                // another phrase queued up to slide in as the first slides off.
                copies: Math.ceil(pathLength / phraseLength) + 1,
                // Shift by exactly one phrase and the frame is identical again.
                shiftPct: (phraseLength / pathLength) * 100,
                animate: speed > 0 && !reduced,
            })
        })

        return () => { cancelled = true }
    }, [text, curve, speed])

    return (
        <svg
            viewBox="0 0 400 80"
            className={className}
            aria-hidden="true"
        >
            {/* Never painted — it exists only as a rail for the text. The path
                runs past both edges of the viewBox so the band has somewhere to
                come from and go to, out of sight behind whatever overlaps it. */}
            <path
                ref={pathRef}
                id={id}
                d={`M ${-overrun},75 Q 200,${75 - curve} ${400 + overrun},75`}
                fill="none"
            />

            {/* Off-screen ruler: one phrase, measured to size the loop. */}
            <text ref={rulerRef} x="-9999" y="-9999" visibility="hidden">
                {phrase}
            </text>

            {loop && (
                <text>
                    <textPath href={`#${id}`} startOffset="0%">
                        {phrase.repeat(loop.copies)}
                        {loop.animate && (
                            <animate
                                attributeName="startOffset"
                                from="0%"
                                to={`-${loop.shiftPct}%`}
                                dur={`${speed}s`}
                                repeatCount="indefinite"
                            />
                        )}
                    </textPath>
                </text>
            )}
        </svg>
    )
}
