import { redirect } from 'next/navigation'

// Off for now, like the landing page (see app/page.js) — nothing on it yet.
export default function AboutUs() {
	redirect('/login')
}
