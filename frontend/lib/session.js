'use client'

// Who is looking at this page, for real.
//
// This replaces the hardcoded `currentRole` / `currentUser` the pages used to
// build themselves against. The shape is deliberately the same — role, id,
// first, last — so a page that used to read the constants reads the session
// instead and nothing else about it has to change.
//
// The frontend is a static export, so there is no server render that could know
// who you are before the page paints. Every page therefore starts in `loading`,
// asks GET /api/auth/me once, and draws itself from the answer. That's what
// `<Gate>` at the bottom of this file is for.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, getToken, setToken } from '@/lib/api'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
	// null = nobody logged in. `loading` is a third state and not the absence of
	// a session: a page that treats "not loaded yet" as "logged out" bounces
	// every visitor to /login for a frame before letting them back in.
	const [user, setUser] = useState(null)
	const [loading, setLoading] = useState(true)

	// Re-read the account behind the current token. Called from the handlers
	// below and from anywhere a page has just changed something the session
	// carries — /account's save, the waiver on the onboarding dashboard.
	const refresh = useCallback(async () => {
		if (!getToken()) {
			setUser(null)
			setLoading(false)
			return null
		}
		try {
			const me = await auth.me()
			setUser(me)
			return me
		} catch {
			// api() has already cleared the token on a 401; anything else here
			// (server down, network) is equally un-signed-in as far as the page
			// is concerned.
			setUser(null)
			return null
		} finally {
			setLoading(false)
		}
	}, [])

	// The one read on load. Not `refresh` directly: with no token that function
	// sets state synchronously, and a setState in an effect body runs the render
	// again before anything paints. Everything here happens after an await or
	// not at all, so the first paint is the loading state and the second is the
	// answer.
	//
	// `live` is the guard for a tab closed (or navigated) mid-request — without
	// it the resolve lands on a provider that has already unmounted.
	useEffect(() => {
		let live = true

		async function boot() {
			if (!getToken()) {
				// user is already null; this only ends the loading state
				await Promise.resolve()
				if (live) setLoading(false)
				return
			}
			try {
				const me = await auth.me()
				if (live) setUser(me)
			} catch {
				if (live) setUser(null)
			} finally {
				if (live) setLoading(false)
			}
		}

		boot()
		return () => { live = false }
	}, [])

	const login = useCallback(async (username, password) => {
		const { token } = await auth.login(username, password)
		setToken(token)
		setLoading(true)
		return refresh()
	}, [refresh])

	const register = useCallback(async (fields) => {
		const { token } = await auth.register(fields)
		setToken(token)
		setLoading(true)
		return refresh()
	}, [refresh])

	const logout = useCallback(() => {
		setToken(null)
		setUser(null)
	}, [])

	const value = useMemo(
		() => ({ user, loading, refresh, login, register, logout }),
		[user, loading, refresh, login, register, logout]
	)

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
	const context = useContext(SessionContext)
	if (!context) {
		throw new Error('useSession must be used inside <SessionProvider> (see app/layout.js)')
	}
	return context
}

// The role to build the page with. 'user' for an account with no membership,
// and also for nobody at all — a signed-out visitor is about to be sent to
// /login anyway, and 'user' is the version of any page that shows the least.
export function useRole() {
	const { user } = useSession()
	return user?.role ?? 'user'
}

// What the sidebar's logout button does. Clearing the token is the whole of it
// — the JWT is stateless, so there's nothing on the server to tell. replace()
// rather than push() so the back button doesn't walk into a page that will only
// bounce straight back here.
export function useSignOut() {
	const { logout } = useSession()
	const router = useRouter()
	return useCallback(() => {
		logout()
		router.replace('/login')
	}, [logout, router])
}

// The person, in the shape the pages already expect: `id`, `first`, `last`.
export function useCurrentUser() {
	const { user } = useSession()
	return useMemo(
		() => ({
			id: user?.userId ?? null,
			first: user?.firstName ?? '',
			last: user?.lastName ?? '',
			username: user?.username ?? '',
		}),
		[user]
	)
}

// ---- the gate --------------------------------------------------------------

// A page's first line. It answers three questions in the order they matter:
//
//   still asking?   draw nothing rather than a page built on a guess
//   logged in?      no -> /login
//   allowed?        no -> whatever the page wants to say about that
//
// `render` is a function rather than children so the page below it is never
// built — and never fires its own effects — for somebody who isn't going to be
// allowed to see it.
export function Gate({ require: required, fallback = null, render }) {
	const { user, loading } = useSession()
	const router = useRouter()

	const shouldRedirect = !loading && !user

	useEffect(() => {
		if (shouldRedirect) router.replace('/login')
	}, [shouldRedirect, router])

	if (loading || !user) return <Loading />
	if (required && !rankAtLeast(user.role, required)) return fallback

	return render(user)
}

// Deliberately quiet: the pages have their own entrance animations, and a
// spinner that flashes for 80ms on every navigation is worse than a beat of
// cream. The background matches the app's so the swap isn't visible.
function Loading() {
	return <main className="min-h-screen w-full bg-cream" aria-busy="true" />
}

// Kept here rather than imported from lib/roles so the gate has no dependency
// that could reintroduce a hardcoded role.
const RANK = { user: 0, member: 1, officer: 2, jboard: 3, treasurer: 4, admin: 5 }

function rankAtLeast(role, min) {
	return (RANK[role] ?? -1) >= (RANK[min] ?? Infinity)
}
