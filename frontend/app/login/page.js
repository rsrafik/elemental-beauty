import AuthPanels from '@/components/login/AuthPanels'

// `cover` lets the page draw under the phone's status bar instead of Safari
// filling that strip with the body colour — so on a phone the bamboo band runs
// right up behind the clock. Only on this page: nothing else here pads itself
// out of the notch, and would slide under it. BambooBand adds the inset to its
// own height so the band still shows as much grove below the bar as before.
export const viewport = {
	viewportFit: 'cover',
}

export default function Login() {
	return <AuthPanels />
}
