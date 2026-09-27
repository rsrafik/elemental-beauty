import AuthPanels from '@/components/login/AuthPanels'

// `cover` lets the page draw under the phone's status bar where the browser
// allows it (a home-screen web app does), and BambooBand adds that inset to its
// own height. Only on this page: nothing else here pads itself out of the notch,
// and would slide under it.
//
// No theme colour and no background of its own for that strip: Safari paints it
// from the page's background when it has nothing better, and a colour chosen
// here only ever read as a bar.
export const viewport = {
	viewportFit: 'cover',
}

export default function Login() {
	return <AuthPanels />
}
