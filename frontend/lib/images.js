// Pictures picked from a phone are megabytes, and every one of them is stored
// as a data URL inside a database row and sent back with every list that
// includes it — a profile photo rides along on every roster and leaderboard
// read. So each picker shrinks the file in the browser first: drawn onto a
// canvas no bigger than `max` on its longer side and re-encoded as a JPEG.
//
// The sizes each picker uses:
export const COVER_MAX = 1600     // lab and event cover photos
export const RECEIPT_MAX = 1600   // receipt photos — the numbers have to stay legible
export const AVATAR_MAX = 320     // profile photos, only ever drawn small

// File -> a data URL (a string the API can store). A file that's already small
// enough, and under `keepUnder` bytes, is kept as it is — no point re-encoding
// a little PNG into a blurrier JPEG.
export function shrinkImage(file, max = COVER_MAX, { quality = 0.85, keepUnder = 600_000 } = {}) {
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
