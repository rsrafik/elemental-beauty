'use client'

import { useEffect, useState } from 'react'
import { members as membersApi } from '@/lib/api'

// "Email all" — a new message with everyone in BCC, so nobody sees anyone
// else's address, opened in the mail service the person sending it is on.
// The server works that out from their address's mail records (see
// src/mailProvider.js): @purdue.edu is Outlook, @gmail.com is Gmail, and a
// school or company domain is whichever of the two actually runs it.
//
//   gmail              Gmail, on that account (authuser picks it when the
//                      browser is signed into more than one), BCC filled in
//   outlook            Outlook on the web, Microsoft 365 — school/work
//   outlook-personal   outlook.com / hotmail / live
//   yahoo              Yahoo Mail
//   other              a mailto: link, which opens the computer's mail app
//
// Outlook's and Yahoo's compose links can't fill in BCC — they only take to,
// subject and body — so for those the message opens addressed to the sender
// (the usual way to send to a hidden list) and the addresses are copied to the
// clipboard, with a note on screen saying to paste them into Bcc.
//
// Web ones open in a new tab; mailto hands over to the mail app in place.

// the services whose compose link ignores bcc
const PASTE_BCC = ['outlook', 'outlook-personal', 'yahoo']

export function composeUrl({ provider, from, bcc, subject = '' }) {
	const list = bcc.join(',')
	switch (provider) {
		case 'gmail':
			return `https://mail.google.com/mail/?${new URLSearchParams({
				view: 'cm', fs: '1', authuser: from, bcc: list, su: subject,
			})}`
		case 'outlook':
			return `https://outlook.office.com/mail/deeplink/compose?${new URLSearchParams({ to: from, subject })}`
		case 'outlook-personal':
			return `https://outlook.live.com/mail/0/deeplink/compose?${new URLSearchParams({ to: from, subject })}`
		case 'yahoo':
			return `https://compose.mail.yahoo.com/?${new URLSearchParams({ to: from, subject })}`
		default: {
			// mailto keeps the commas between addresses unescaped
			const query = [`bcc=${bcc.map(encodeURIComponent).join(',')}`]
			if (subject) query.push(`subject=${encodeURIComponent(subject)}`)
			return `mailto:?${query.join('&')}`
		}
	}
}

// The signed-in person's { email, provider }, asked for when the page loads —
// the click has to open the tab there and then, since a tab opened after
// waiting on a request is stopped as a popup. Until it answers (or if it
// can't), the mail app is the fallback.
export function useMailProvider() {
	const [mail, setMail] = useState({ email: '', provider: 'other' })
	useEffect(() => {
		let live = true
		membersApi.mail().then((reply) => live && setMail(reply)).catch(() => {})
		return () => { live = false }
	}, [])
	return mail
}

// A short note in the corner of the page, gone after a few seconds. Built by
// hand because it's shown from a click handler on whatever page called this.
function note(text) {
	// a second click replaces the first note rather than stacking on it
	document.getElementById('compose-note')?.remove()
	const el = document.createElement('div')
	el.id = 'compose-note'
	el.setAttribute('role', 'status')
	el.className = `
		menu-open
		fixed
		bottom-6
		left-1/2
		-translate-x-1/2
		z-[70]
		max-w-[90vw]
		rounded-full
		bg-black
		px-5
		py-3
		font-vietnam
		font-semibold
		text-sm
		text-cream
		shadow-[0_10px_30px_rgba(0,0,0,0.3)]
	`
	el.textContent = text
	document.body.appendChild(el)
	// long enough to still be there after a look at the new tab, or click it away
	el.addEventListener('click', () => el.remove())
	setTimeout(() => el.remove(), 20000)
}

// A throwaway link is clicked rather than calling window.open, which some
// browsers quietly swallow when asked for a detached ('noopener') tab.
export function openCompose({ provider, from, bcc, subject }) {
	const url = composeUrl({ provider, from, bcc, subject })

	// started inside the click, which is what lets it write to the clipboard
	if (PASTE_BCC.includes(provider)) {
		const count = `${bcc.length} ${bcc.length === 1 ? 'address' : 'addresses'}`
		navigator.clipboard
			?.writeText(bcc.join('; '))
			.then(
				() => note(`${count} copied — click Bcc in the new message and paste them in`),
				() => note(`Couldn't copy the ${count} — allow clipboard access and try again`)
			)
	}

	if (url.startsWith('mailto:')) {
		window.location.href = url
		return
	}
	const link = document.createElement('a')
	link.href = url
	link.target = '_blank'
	link.rel = 'noopener noreferrer'
	document.body.appendChild(link)
	link.click()
	link.remove()
}
