'use client'

import { useEffect, useRef } from 'react'

// The hero's background: soap bubbles. They drift on the cream, run together
// when they meet, and get stirred by the pointer. Each one is a lens — the
// wordmark under it bends, and its edges split into colour.
//
// What a bubble is made of. A soap film is clear; its colour is interference,
// light reflecting off the front and the back of the film and the two
// reflections cancelling or reinforcing depending on how thick the film is
// there. So the shader keeps a slowly swirling "thickness" for every point of
// every bubble and turns it into pink, blue and green, in bands that crowd
// together towards the rim where the film is seen at a slant. Face-on the
// film is nearly invisible and you see the page through it; at the rim it is
// a mirror. On top of that sit the reflections: a hard window of light, its
// echo on the far side, and a faint sky.
//
// How it is drawn. The bubbles are metaballs: every one adds r²/d² to a field
// and wherever the field passes 1 there is liquid, which is what makes two of
// them neck together instead of overlapping. One fragment shader does the
// whole picture per pixel, so there are no meshes and no library — it starts
// with the page and costs a few kilobytes.
//
// Why the canvas draws the letters. Bending the type means the shader has to
// sample it, so once the name has finished arriving (the page script says so
// with `lp:hero-settled`) it is copied into a texture, each piece at the spot
// the real one occupies and in its own face and colour, and the real ones are
// made transparent. They stay in the page for selection and screen readers.
// If WebGL isn't there none of this happens and the ordinary letters are
// simply what you see.
//
// A "piece" is whatever carries `lp-ch`: one capital of the set word, or the
// whole of the written word, which is never split because a script's letters
// join.
//
// The motion is simulated here, not in the shader: each droplet is a point on
// a soft spring to a slowly wandering home, and a moving pointer adds its own
// velocity to the ones it passes — so a stir carries on after the hand stops.

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

const PAPER = rgb('#FFFBEB')

// x, y: home, as a fraction of the hero. r: radius as a fraction of its shorter
// side. depth: how far it lags the page on scroll. tint: the bubble's own
// hue. It is not painted that colour — a film is clear — but its iridescence
// is centred on it, so every bubble shimmers through a different part of the
// colour wheel, and where two join their hues run into each other.
const DROPS = [
	{ x: 0.0, y: 0.1, r: 0.15, tint: '#FF7D45', depth: 0.34 }, // orange
	{ x: 0.95, y: 0.06, r: 0.12, tint: '#FFD92B', depth: 0.22 }, // yellow
	{ x: 0.7, y: 0.33, r: 0.07, tint: '#5FD98A', depth: 0.46 }, // green
	{ x: 0.36, y: 0.62, r: 0.085, tint: '#FF5FA2', depth: 0.28 }, // pink
	{ x: 0.5, y: 0.16, r: 0.045, tint: '#9F86FF', depth: 0.52 }, // violet
	{ x: 0.99, y: 0.92, r: 0.16, tint: '#4FB8FF', depth: 0.18 }, // sky blue
	{ x: 0.03, y: 0.97, r: 0.11, tint: '#3FDCC2', depth: 0.4 }, // teal
	{ x: 0.6, y: 0.8, r: 0.055, tint: '#FFA63D', depth: 0.5 }, // amber
	{ x: 0.41, y: 0.3, r: 0.035, tint: '#FF6B5C', depth: 0.6 }, // coral
	{ x: 0.19, y: 0.4, r: 0.05, tint: '#B4E04A', depth: 0.44 }, // lime
	{ x: 0.9, y: 0.5, r: 0.065, tint: '#D77BFF', depth: 0.3 }, // orchid
]

// one more than the list: the last bubble is the one under the pointer
const COUNT = DROPS.length + 1
// the one under the pointer shimmers in the blue-violets
const LENS_TINT = [0.62, 0.6, 1]

const VERTEX = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`

const FRAGMENT = `#version 300 es
precision highp float;
out vec4 colour;

uniform vec2 uRes;            // the canvas, in device pixels
uniform float uPx;            // device pixels per CSS pixel
uniform vec3 uDrop[${COUNT}]; // x, y from the top-left, and radius
uniform vec3 uTint[${COUNT}];
uniform sampler2D uText;
uniform float uTextOn;
uniform vec3 uPaper;
uniform float uTime;

// ---- slow, smooth randomness, for the film's thickness ----
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float cloud(vec2 p) {
	float sum = 0.0, weight = 0.5;
	for (int i = 0; i < 3; i++) {
		sum += weight * noise(p);
		p = p * 2.03 + 17.3;
		weight *= 0.5;
	}
	return sum;
}

// Turn a colour round the colour wheel by an angle, keeping how light and how
// strong it is.
vec3 turn(vec3 c, float angle) {
	vec3 axis = vec3(0.57735);
	return c * cos(angle) + cross(axis, c) * sin(angle) + axis * dot(axis, c) * (1.0 - cos(angle));
}

// A hue at film strength: the colour pushed to its purest, then let down with
// white, which is how saturated a soap film ever gets.
vec3 vivid(vec3 c) {
	float high = max(c.r, max(c.g, c.b));
	float low = min(c.r, min(c.g, c.b));
	vec3 pure = (c - low) / max(high - low, 1e-4);
	return mix(vec3(1.0), pure, 0.66);
}

// The colour a soap film shows for a given thickness. Every bubble has a hue
// of its own, and its film runs between that hue and the two a third of the
// way round the wheel on either side of it. So each bubble still shimmers
// through three colours as its film thickens, but no two bubbles shimmer
// through the same three: an orange one goes to rose and lime, a violet one
// to pink and blue.
vec3 film(float phase, vec3 own) {
	vec3 first = vivid(own);
	vec3 second = vivid(clamp(turn(first, 1.25), 0.0, 1.0));
	vec3 third = vivid(clamp(turn(first, -1.25), 0.0, 1.0));
	vec3 w = 0.5 + 0.5 * cos(6.2832 * (phase - vec3(0.0, 0.3333, 0.6667)));
	w *= w;
	// its own hue counts for a little more than the other two, so the bubble
	// reads as "the orange one" at a glance
	w.x *= 1.5;
	return (first * w.x + second * w.y + third * w.z) / (w.x + w.y + w.z);
}

// The field, its slope, and the seed of whichever bubbles are nearest.
float field(vec2 p, out vec2 slope, out vec3 tint) {
	float f = 0.0;
	slope = vec2(0.0);
	vec3 mixed = vec3(0.0);
	float weight = 0.0;
	for (int i = 0; i < ${COUNT}; i++) {
		vec2 d = p - uDrop[i].xy;
		float r2 = uDrop[i].z * uDrop[i].z;
		float q = dot(d, d) + 1.0;
		float w = r2 / q;
		f += w;
		slope += -2.0 * r2 * d / (q * q);
		// cubed, so where two droplets join the colour changes over a short
		// distance instead of muddying the whole of both
		float w3 = w * w * w;
		mixed += uTint[i] * w3;
		weight += w3;
	}
	tint = mixed / max(weight, 1e-6);
	return f;
}

float fieldOnly(vec2 p) {
	float f = 0.0;
	for (int i = 0; i < ${COUNT}; i++) {
		vec2 d = p - uDrop[i].xy;
		f += uDrop[i].z * uDrop[i].z / (dot(d, d) + 1.0);
	}
	return f;
}

// the wordmark at this point: its colour, and in alpha how much of it there is
vec4 ink(vec2 p) {
	vec2 uv = p / uRes;
	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
	vec4 t = texture(uText, uv);
	// the canvas hands over colour already multiplied by alpha
	return vec4(t.a > 0.0 ? t.rgb / t.a : t.rgb, t.a * uTextOn);
}

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

	vec2 slope;
	vec3 tint;
	float f = field(p, slope, tint);
	float steep = length(slope);

	// the edge, one pixel wide whatever the droplet's size
	float inside = smoothstep(1.0 - steep, 1.0 + steep, f);

	vec4 here = ink(p);
	vec3 result = mix(uPaper, here.rgb, here.a);

	// the shadow each bubble lays on the paper: the same field, read a little
	// up and to the left. Faint, because a bubble is mostly not there, and in
	// the dark orange rather than grey.
	float shade = smoothstep(0.72, 1.25, fieldOnly(p - vec2(7.0, 13.0) * uPx));
	result = mix(result, vec3(0.66, 0.25, 0.07), shade * 0.11 * (1.0 - inside));

	if (inside > 0.0) {
		vec2 outward = steep > 0.0 ? -slope / steep : vec2(0.0);

		// 0 at the rim, 1 on the flat top of the bubble
		float height = clamp((f - 1.0) / 1.4, 0.0, 1.0);
		float tilt = (1.0 - height) * (1.0 - height);

		// The lens. What is under a bubble is pulled towards its middle,
		// hardest at the rim. f / steep is about half the distance to the
		// centre there, so 0.42 of it moves the rim's view a fifth of the way
		// in: enough to read as a lens, not so much that a letter collapses
		// into a blot. The three channels bend by slightly different amounts,
		// which is the colour fringe on the type.
		vec2 bend = outward * tilt * (f / max(steep, 1e-6)) * 0.42;
		vec4 r = ink(p - bend * 0.86);
		vec4 g = ink(p - bend * 0.93);
		vec4 b = ink(p - bend * 1.00);
		vec3 seen = vec3(mix(uPaper.r, r.r, r.a), mix(uPaper.g, g.g, g.a), mix(uPaper.b, b.b, b.a));

		// The bubble as a sphere. For one bubble the field is r²/d², so its
		// inverse root is how far out from the middle this point is: 0 at the
		// centre, 1 at the rim. That gives the direction the film faces.
		float out01 = clamp(inversesqrt(max(f, 1.0)), 0.0, 1.0);
		vec3 normal = vec3(outward * out01, sqrt(1.0 - out01 * out01));
		// how much of a mirror the film is here: barely, face-on; almost
		// entirely, at the rim
		float mirror = pow(out01, 3.0);

		// ---- the film ----
		// Its thickness: slow noise, bent by more slow noise, so it swirls
		// and drains rather than sliding. Each bubble starts somewhere else.
		float seed = dot(tint, vec3(1.7, 3.1, 5.3));
		vec2 q = p / uPx * 0.0045 + seed;
		float t = uTime * 0.06;
		vec2 swirl = vec2(cloud(q * 1.3 + vec2(t, -t * 0.7)), cloud(q * 1.3 + vec2(5.2 - t * 0.8, 1.3 + t)));
		float thick = cloud(q * 2.0 + swirl * 1.6 + vec2(0.0, t * 0.5));
		// Seen at a slant the light has further to travel through the film,
		// which shifts the colour: that is why the bands crowd into rings
		// near the rim. The film is also a little thicker towards the bottom,
		// where it drains to.
		float phase = thick * 2.6 + out01 * out01 * 1.25 + outward.y * out01 * 0.25 + seed * 0.37;
		vec3 sheen = film(phase, tint);

		// Clear in the middle, coloured where the film is thick, and almost
		// all colour at the rim.
		float veil = clamp(0.14 + 0.24 * smoothstep(0.32, 0.72, thick) + 0.62 * mirror, 0.0, 0.92);
		vec3 through = mix(seen, sheen, veil);

		// ---- what it reflects ----
		// a pale sky above and the warm page below, only where it is a mirror
		vec3 sky = mix(vec3(1.0, 0.96, 0.9), vec3(0.93, 0.97, 1.0), 0.5 - 0.5 * normal.y);
		through = mix(through, sky, mirror * 0.3);

		// the light is up and to the left: a hard bright window where it
		// lands, a small second one beside it…
		vec3 light = normalize(vec3(-0.5, -0.7, 0.5));
		float window = smoothstep(0.93, 0.965, dot(normal, light));
		float second = smoothstep(0.988, 0.996, dot(normal, normalize(vec3(-0.78, -0.3, 0.55))));
		// …and its reflection off the back of the bubble: a soft arc low on
		// the far side, just inside the rim
		float far = dot(outward, -normalize(light.xy));
		float arc = smoothstep(0.55, 0.92, far) * smoothstep(0.7, 0.88, out01) * (1.0 - smoothstep(0.92, 1.0, out01));
		through = mix(through, vec3(1.0), arc * 0.6);
		through = mix(through, vec3(1.0), max(window, second) * 0.95);

		// a hairline of deeper colour right at the edge, which is what
		// separates a clear bubble from a pale page
		through *= 1.0 - 0.2 * smoothstep(0.93, 1.0, out01);

		result = mix(result, through, inside);
	}

	colour = vec4(result, 1.0);
}`

function compile(gl, type, source) {
	const shader = gl.createShader(type)
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader) || 'shader failed to compile')
	}
	return shader
}

export default function Emulsion() {
	const canvasRef = useRef(null)

	useEffect(() => {
		const canvas = canvasRef.current
		const hero = canvas.parentElement
		const gl = canvas.getContext('webgl2', { alpha: false, antialias: false })

		// An opaque canvas that never draws is a black rectangle, so on any
		// failure it is taken out and the hero is its plain cream.
		const giveUp = () => {
			canvas.style.display = 'none'
		}
		if (!gl) return giveUp()

		let program
		try {
			program = gl.createProgram()
			gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
			gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
			gl.linkProgram(program)
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
		} catch (error) {
			// the page still has its ordinary letters on its ordinary cream
			console.warn('Emulsion: WebGL program unavailable.', error)
			return giveUp()
		}
		gl.useProgram(program)

		// one triangle that covers the screen
		const buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
		const corner = gl.getAttribLocation(program, 'corner')
		gl.enableVertexAttribArray(corner)
		gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)

		const uniform = (name) => gl.getUniformLocation(program, name)
		const uRes = uniform('uRes')
		const uPx = uniform('uPx')
		const uDrop = uniform('uDrop')
		const uTextOn = uniform('uTextOn')
		const uTime = uniform('uTime')
		gl.uniform3fv(uniform('uPaper'), PAPER)
		gl.uniform3fv(uniform('uTint'), new Float32Array([...DROPS.flatMap((drop) => rgb(drop.tint)), ...LENS_TINT]))
		gl.uniform1i(uniform('uText'), 0)

		const texture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))

		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const scratch = document.createElement('canvas')
		const pen = scratch.getContext('2d')
		const wordmark = hero.querySelector('.lp-wordmark')

		let width = 0
		let height = 0
		let dpr = 1
		let settled = false

		// Copy the wordmark into the texture, piece by piece. Each piece is its
		// own inline-block in the page, so its left edge is where its first glyph
		// starts; the baseline comes from the sizeless marker at the end of the
		// line, whose box sits exactly on it.
		const drawWordmark = () => {
			if (!wordmark || !settled || !width) return
			scratch.width = canvas.width
			scratch.height = canvas.height
			pen.clearRect(0, 0, scratch.width, scratch.height)
			pen.textBaseline = 'alphabetic'
			const frame = canvas.getBoundingClientRect()
			// Last line first: the lines overlap, and the first one lies on top
			// in the page, so it has to be the last one painted here.
			for (const line of [...wordmark.querySelectorAll('[data-line]')].reverse()) {
				// each line is in its own face, size and colour
				const style = getComputedStyle(line)
				pen.font = `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * dpr}px ${style.fontFamily}`
				pen.letterSpacing = style.letterSpacing === 'normal' ? '0px' : `${parseFloat(style.letterSpacing) * dpr}px`
				pen.fillStyle = style.color
				const upper = style.textTransform === 'uppercase'
				const baseline = line.querySelector('.lp-baseline').getBoundingClientRect().top - frame.top
				for (const piece of line.querySelectorAll('.lp-ch')) {
					const left = piece.getBoundingClientRect().left - frame.left
					const text = upper ? piece.textContent.toUpperCase() : piece.textContent
					pen.fillText(text, left * dpr, baseline * dpr)
				}
			}
			gl.bindTexture(gl.TEXTURE_2D, texture)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch)
			gl.uniform1f(uTextOn, 1)
			wordmark.classList.add('is-liquid')
		}

		const resize = () => {
			dpr = Math.min(window.devicePixelRatio || 1, 2)
			width = canvas.clientWidth
			// The bubbles are placed against the hero, but the canvas hangs
			// below it (see the markup), so one that sits on the hero's foot is
			// drawn whole instead of being cut along it.
			height = hero.clientHeight
			canvas.width = Math.round(width * dpr)
			canvas.height = Math.round(canvas.clientHeight * dpr)
			gl.viewport(0, 0, canvas.width, canvas.height)
			gl.uniform2f(uRes, canvas.width, canvas.height)
			gl.uniform1f(uPx, dpr)
			drawWordmark()
		}

		// ---- the simulation ----
		const drops = DROPS.map((drop, index) => ({
			...drop,
			phase: index * 2.399,
			pace: 0.16 + ((index * 37) % 11) / 60,
			px: null,
			py: null,
			vx: 0,
			vy: 0,
		}))
		const pointer = { x: 0, y: 0, vx: 0, vy: 0, over: false, lx: 0, ly: 0, size: 0, seen: 0 }
		const packed = new Float32Array(COUNT * 3)

		const onMove = (event) => {
			const frame = canvas.getBoundingClientRect()
			const x = event.clientX - frame.left
			const y = event.clientY - frame.top
			const now = performance.now()
			const gap = Math.max(now - pointer.seen, 8) / 1000
			if (pointer.over) {
				// eased, so one jumpy mouse event doesn't fling everything
				pointer.vx += ((x - pointer.x) / gap - pointer.vx) * 0.4
				pointer.vy += ((y - pointer.y) / gap - pointer.vy) * 0.4
			} else {
				pointer.lx = x
				pointer.ly = y
			}
			pointer.x = x
			pointer.y = y
			pointer.seen = now
			pointer.over = y > -40 && y < height + 40
		}
		const onLeave = () => {
			pointer.over = false
		}
		window.addEventListener('pointermove', onMove, { passive: true })
		document.documentElement.addEventListener('pointerleave', onLeave)

		let last = performance.now()
		let clock = 0
		let raf = 0
		let visible = true

		const step = (now) => {
			const dt = Math.min((now - last) / 1000, 0.05)
			last = now
			clock += dt
			const unit = Math.min(width, height)
			const scroll = window.scrollY

			// a pointer that has stopped has no velocity left to give
			if (now - pointer.seen > 60) {
				pointer.vx *= 0.8
				pointer.vy *= 0.8
			}

			drops.forEach((drop, index) => {
				const homeX = drop.x * width + Math.sin(clock * drop.pace + drop.phase) * unit * 0.04
				const homeY =
					drop.y * height +
					Math.cos(clock * drop.pace * 0.8 + drop.phase * 1.7) * unit * 0.045 -
					scroll * drop.depth
				if (drop.px === null) {
					drop.px = homeX
					drop.py = homeY
				}
				drop.vx += (homeX - drop.px) * 2.4 * dt
				drop.vy += (homeY - drop.py) * 2.4 * dt

				if (pointer.over) {
					const dx = drop.px - pointer.x
					const dy = drop.py - pointer.y
					const distance = Math.hypot(dx, dy) || 1
					const reach = drop.r * unit + 170
					if (distance < reach) {
						const near = 1 - distance / reach
						// dragged along with the stir, and nudged out of its way
						drop.vx += pointer.vx * near * 2.6 * dt + (dx / distance) * near * 260 * dt
						drop.vy += pointer.vy * near * 2.6 * dt + (dy / distance) * near * 260 * dt
					}
				}

				const drag = Math.exp(-2.2 * dt)
				drop.vx *= drag
				drop.vy *= drag
				drop.px += drop.vx * dt
				drop.py += drop.vy * dt

				const breathe = 1 + Math.sin(clock * 0.7 + drop.phase) * 0.04
				packed[index * 3] = drop.px * dpr
				packed[index * 3 + 1] = drop.py * dpr
				packed[index * 3 + 2] = drop.r * unit * breathe * dpr
			})

			// the clear droplet under the pointer: it trails a little, swells when
			// the pointer arrives and drains away when it leaves
			const follow = Math.min(1, dt * 9)
			pointer.lx += (pointer.x - pointer.lx) * follow
			pointer.ly += (pointer.y - pointer.ly) * follow
			pointer.size += ((pointer.over ? unit * 0.085 : 0) - pointer.size) * Math.min(1, dt * 5)
			packed[DROPS.length * 3] = pointer.lx * dpr
			packed[DROPS.length * 3 + 1] = pointer.ly * dpr
			packed[DROPS.length * 3 + 2] = pointer.size * dpr

			gl.uniform3fv(uDrop, packed)
			// the film swirls on the same clock the bubbles drift on
			gl.uniform1f(uTime, clock)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
		}

		const loop = (now) => {
			step(now)
			if (visible && !still) raf = requestAnimationFrame(loop)
		}

		const onSettled = () => {
			settled = true
			drawWordmark()
			if (still) step(performance.now())
		}
		window.addEventListener('lp:hero-settled', onSettled)

		const sizes = new ResizeObserver(() => {
			resize()
			// with motion off there is no loop to pick the new size up
			if (still) step(performance.now())
		})
		sizes.observe(canvas)

		// nothing is drawn while the hero is off screen
		const sight = new IntersectionObserver(([entry]) => {
			const was = visible
			visible = entry.isIntersecting
			if (visible && !was && !still) {
				last = performance.now()
				raf = requestAnimationFrame(loop)
			}
		})
		sight.observe(canvas)

		resize()
		raf = requestAnimationFrame(loop)
		// the letters may have landed before this component mounted
		if (document.documentElement.dataset.lpHero === 'settled') onSettled()

		return () => {
			cancelAnimationFrame(raf)
			sizes.disconnect()
			sight.disconnect()
			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('lp:hero-settled', onSettled)
			document.documentElement.removeEventListener('pointerleave', onLeave)
			wordmark?.classList.remove('is-liquid')
			gl.deleteTexture(texture)
			gl.deleteBuffer(buffer)
			gl.deleteProgram(program)
		}
	}, [])

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			className="
				absolute
				inset-x-0
				top-0
				-z-10
				h-[145%]
				w-full
			"
		/>
	)
}
