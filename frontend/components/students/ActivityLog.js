'use client'

import { useEffect, useState } from 'react'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'
import { activity as activityApi } from '@/lib/api'
import { roleLabel } from '@/lib/roles'

// /students' "activity": who did what to whom — role changes, points given and
// taken back, check-ins, students added and removed, dues. Newest first, a page
// at a time. Written by the server (src/activity.js); names are as they were
// at the time, so a removed member still reads right.

const AWARD = {
	instagram_repost: 'an instagram repost',
	instagram_follow: 'following on instagram',
	discord_join: 'joining the discord',
}

const money = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// One entry as a sentence. Bold spans are people; everything else is plain.
function sentence(entry) {
	const actor = <b>{entry.actorName}</b>
	const target = <b>{entry.targetName ?? 'someone'}</b>
	const d = entry.details ?? {}
	const pts = entry.points
	switch (entry.action) {
		case 'role_changed':
			return <>{actor} changed {target}&apos;s role from {roleLabel(d.from)} to {roleLabel(d.to)}</>
		case 'points_awarded':
			return <>{actor} gave {target} +{pts} for {AWARD[d.reason] ?? d.reason}</>
		case 'checked_in':
			return <>{actor} {d.by === 'qr' ? 'scanned' : 'checked'} {target} into {d.title} (+{pts})</>
		case 'checkin_undone':
			return <>{actor} undid {target}&apos;s check-in at {d.title} ({pts})</>
		case 'member_added':
			return <>{actor} added {target} as {d.role === 'admin' ? 'an' : 'a'} {roleLabel(d.role)}</>
		case 'member_removed':
			return <>{actor} removed {target} ({roleLabel(d.role)}, {d.points} points)</>
		case 'account_deleted':
			return <>{target} deleted their own account ({d.points} points)</>
		case 'dues_paid':
			return Number(d.amount) > 0
				? <>{actor} marked {target}&apos;s {d.schoolYear} dues paid ({money(d.amount)})</>
				: <>{actor} waived {target}&apos;s {d.schoolYear} dues</>
		case 'dues_cleared':
			return <>{actor} took back {target}&apos;s {d.schoolYear} dues</>
		case 'dues_waived':
			return <>{actor} let {target} into {d.title} without paying {d.schoolYear} dues</>
		default:
			return <>{actor} — {entry.action}</>
	}
}

const DOT = {
	role_changed: 'bg-[#6B4FBF]',
	points_awarded: 'bg-salmon',
	checked_in: 'bg-green',
	checkin_undone: 'bg-black/30',
	member_added: 'bg-blue',
	member_removed: 'bg-red',
	account_deleted: 'bg-red',
	dues_paid: 'bg-yellow',
	dues_cleared: 'bg-black/30',
	dues_waived: 'bg-yellow',
}

function when(at) {
	return new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

export default function ActivityLog({ onClose }) {
	const [entries, setEntries] = useState([])
	const [more, setMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		let live = true
		activityApi
			.list()
			.then((page) => {
				if (!live) return
				setEntries(page.entries)
				setMore(page.more)
			})
			.catch((err) => live && setError(err.message))
			.finally(() => live && setLoading(false))
		return () => { live = false }
	}, [])

	const loadMore = async () => {
		if (loading || entries.length === 0) return
		setLoading(true)
		try {
			const page = await activityApi.list({ before: entries[entries.length - 1].activityId })
			setEntries((previous) => [...previous, ...page.entries])
			setMore(page.more)
		} catch (err) {
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Popup title="activity" onClose={onClose}>
			{(dismiss) => (
				<>
					<p className="
						mt-3
						font-vietnam
						text-sm
						text-black/55
					">
						Who changed what — roles, points, check-ins, and who was added or removed.
					</p>

					{error && (
						<p className="
							mt-4
							font-vietnam
							text-sm
							text-salmon-dark
						">
							{error}
						</p>
					)}

					{!loading && !error && entries.length === 0 && (
						<p className="
							mt-4
							font-vietnam
							text-sm
							text-black/45
						">
							Nothing yet — it fills in as officers make changes.
						</p>
					)}

					<ul className="mt-3">
						{entries.map((entry) => (
							<li
								key={entry.activityId}
								className="
									flex
									gap-3
									py-3
									border-b
									border-black/10
									last:border-b-0
								"
							>
								<span className={`
									mt-1.5
									w-2
									h-2
									shrink-0
									rounded-full
									${DOT[entry.action] ?? 'bg-black/30'}
								`} />
								<div className="min-w-0">
									<p className="
										font-vietnam
										text-sm
										leading-snug
										text-black
										[&_b]:font-semibold
									">
										{sentence(entry)}
									</p>
									<p className="
										mt-0.5
										font-vietnam
										text-[12px]
										text-black/45
									">
										{when(entry.createdAt)}
									</p>
								</div>
							</li>
						))}
					</ul>

					<div className="
						mt-6
						flex
						justify-end
						gap-3
					">
						{more && (
							<PopupButton onClick={loadMore}>{loading ? 'loading…' : 'older'}</PopupButton>
						)}
						<PopupButton onClick={() => dismiss(onClose)}>close</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}
