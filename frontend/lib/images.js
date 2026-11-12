// Pictures picked from a phone are megabytes. Each picker shrinks the file in
// the browser first — drawn onto a canvas no bigger than `max` on its longer
// side and re-encoded as a JPEG — so what's stored (and what every viewer
// downloads, once — see storedImage below) is no bigger than it's ever shown.
// Only new uploads: what's already saved is left as it is.
//
// The sizes each picker uses:
export const COVER_MAX = 1000     // lab and event cover photos — a card or a page header
export const RECEIPT_MAX = 1400   // receipt photos — the numbers have to stay legible
export const AVATAR_MAX = 256     // profile photos, only ever drawn small
export const QR_MAX = 800         // payment QR codes — big enough to scan off a phone

// ---- the frames pictures are shown in --------------------------------------
//
// Every picker opens the cropper (components/ImageCropper.js) on the shape of
// the frame its picture is shown in, so what's picked is exactly what shows:
// the box keeps this width / height however its corners are dragged. Each
// number is read off the markup that draws the frame; when that changes, this
// changes.
//
//   aspect   width / height of the frame
//   max      the saved picture's longer side, in pixels (see above)
//   shape    how the preview beside the cropper is rounded: 'rect', 'circle'
//            or 'pill'
export const FRAMES = {
	// lab and event cards: aspect-[4/3] (MemberLabs, OfficerLabs, MemberEvents,
	// OfficerEvents). The lab page header and the editor draw the same cover a
	// little wider or narrower, with object-cover trimming the difference.
	cover: { aspect: 4 / 3, max: COVER_MAX, shape: 'rect', label: 'the cover on its card' },
	// the profile circle and the square on the pass
	avatar: { aspect: 1, max: AVATAR_MAX, shape: 'circle', label: 'the profile picture' },
	// the square tiles QR codes sit in (AcceptedPaymentsCard, PaySection)
	qr: { aspect: 1, max: QR_MAX, quality: 0.92, shape: 'rect', label: 'the QR code tile' },
	// the landing page (components/landing/):
	// Team.js — the portraits are aspect-[3/4]
	person: { aspect: 3 / 4, max: COVER_MAX, shape: 'rect', label: 'the portrait on the landing page' },
	// Album.js — a 5:7 card whose photo is its top 88% (h-[88%]), above the
	// strip with the title: 5 wide by 7 × 0.88 tall
	album: { aspect: 5 / (7 * 0.88), max: COVER_MAX, shape: 'rect', label: 'the photo on its card' },
	// Closing.js — a pill with a picture is 22:9 (its aspect-[22/9]): 9vw tall,
	// 14vw wide inside 4vw of padding each side, as the sponsor band was drawn
	sponsor: { aspect: 22 / 9, max: COVER_MAX, shape: 'pill', label: 'the sponsor pill' },
}

// The part of a loaded <img> inside `area` (in the picture's own pixels) → a
// JPEG data URL no bigger than frame.max on its longer side, and exactly the
// frame's shape.
export function cropToDataUrl(img, area, { aspect, max = COVER_MAX, quality = 0.78 }) {
	const scale = Math.min(1, max / Math.max(area.width, area.height))
	const canvas = document.createElement('canvas')
	if (aspect >= 1) {
		canvas.width = Math.max(1, Math.round(area.width * scale))
		canvas.height = Math.max(1, Math.round(canvas.width / aspect))
	} else {
		canvas.height = Math.max(1, Math.round(area.height * scale))
		canvas.width = Math.max(1, Math.round(canvas.height * aspect))
	}
	const context = canvas.getContext('2d')
	// JPEG has no transparency — a PNG's clear bits would turn black
	context.fillStyle = '#fff'
	context.fillRect(0, 0, canvas.width, canvas.height)
	context.imageSmoothingQuality = 'high'
	context.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
	return canvas.toDataURL('image/jpeg', quality)
}

// File -> a data URL (a string the API can store). A file that's already small
// enough, and under `keepUnder` bytes, is kept as it is — no point re-encoding
// a little PNG into a blurrier JPEG.
export function shrinkImage(file, max = COVER_MAX, { quality = 0.78, keepUnder = 150_000 } = {}) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onerror = () => reject(new Error('Could not read that image'))
		reader.onload = () => {
			const img = new Image()
			img.onerror = () => reject(new Error('That file isn’t an image'))
			img.onload = () => {
				const scale = Math.min(1, max / Math.max(img.width, img.height))
				if (scale === 1 && file.size < keepUnder) return resolve(reader.result)
				const canvas = document.createElement('canvas')
				canvas.width = Math.round(img.width * scale)
				canvas.height = Math.round(img.height * scale)
				const context = canvas.getContext('2d')
				// JPEG has no transparency — a PNG's clear bits would turn black
				context.fillStyle = '#fff'
				context.fillRect(0, 0, canvas.width, canvas.height)
				context.drawImage(img, 0, 0, canvas.width, canvas.height)
				resolve(canvas.toDataURL('image/jpeg', quality))
			}
			img.src = reader.result
		}
		reader.readAsDataURL(file)
	})
}

// ---- showing them ----------------------------------------------------------
//
// The API hands pictures out as addresses (GET /api/img/:kind/:id/:key), and
// the address only ever means one picture — a new one gets a new key. So each
// is fetched once (with the sign-in token, which an <img src> can't send),
// kept in the browser's Cache Storage, and shown from there on every later
// visit without asking the server at all. Someone's own paperwork (payment
// screenshots, receipts) is fetched each time and never kept.
//
// A data URL (a picture just picked, not saved yet) or a plain path is used as
// it is.

const CACHE = 'eb-img-v1'
const PRIVATE = ['payment', 'receipt']
// address -> object URL, for this page's life (the same cover on a card and
// its page is decoded once)
const shown = new Map()
const loading = new Map()

const isStored = (src) => typeof src === 'string' && src.startsWith('/api/img/')

// the address's kind and id ('lab/12'), what a newer key replaces
const ownerOf = (src) => src.split('/').slice(3, 5).join('/')

async function openCache() {
	try {
		return typeof caches === 'undefined' ? null : await caches.open(CACHE)
	} catch {
		return null
	}
}

async function fetchPicture(src, token) {
	const kind = src.split('/')[3]
	const keep = !PRIVATE.includes(kind)
	const cache = keep ? await openCache() : null
	if (cache) {
		try {
			const hit = await cache.match(src)
			if (hit) return await hit.blob()
		} catch {}
	}
	const response = await fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
	if (!response.ok) throw new Error(`Picture not available (${response.status})`)
	const blob = await response.blob()
	if (cache) {
		try {
			// the older pictures this one replaced go
			const owner = ownerOf(src)
			for (const request of await cache.keys()) {
				const path = new URL(request.url).pathname
				if (path !== src && ownerOf(path) === owner) await cache.delete(request)
			}
			await cache.put(src, new Response(blob, { headers: { 'Content-Type': blob.type } }))
		} catch {}
	}
	return blob
}

// src -> something an <img> can show: itself, or a promise of an object URL
export function storedImage(src, token) {
	if (!isStored(src)) return src ?? null
	if (shown.has(src)) return shown.get(src)
	if (!loading.has(src)) {
		loading.set(src, fetchPicture(src, token)
			.then((blob) => {
				const url = URL.createObjectURL(blob)
				shown.set(src, url)
				return url
			})
			.finally(() => loading.delete(src)))
	}
	return loading.get(src)
}

// the kept pictures go when someone signs out (lib/api.js setToken)
export function forgetStoredImages() {
	try {
		if (typeof caches !== 'undefined') caches.delete(CACHE).catch(() => {})
	} catch {}
	for (const url of shown.values()) URL.revokeObjectURL(url)
	shown.clear()
}
