import { redirect } from 'next/navigation'

// The landing page's old preview address. The page lives at `/` now
// (app/page.js), so anything still linking here lands there.
export default function LandingPreview() {
	redirect('/')
}
