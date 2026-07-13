// Club point values — single source of truth. Attendance points are awarded
// automatically at the moment a member transitions to 'attended' (check-in or
// waitlist admission); sitting on the waitlist earns nothing. The social-media
// actions are awarded manually by officers via POST /members/:id/points.
export const POINTS = {
    instagram_repost: 1,
    instagram_follow: 2,
    discord_join: 2,
    social_event: 3,
    official_event: 5,
    lab: 8
}

// The only actions officers may award by hand — attendance points are
// deliberately NOT in this list so they can't be double-granted manually.
export const MANUAL_ACTIONS = ['instagram_repost', 'instagram_follow', 'discord_join']

export function eventPoints(eventType) {
    return eventType === 'official' ? POINTS.official_event : POINTS.social_event
}
