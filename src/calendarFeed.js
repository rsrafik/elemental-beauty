// The calendar feed's file: labs and events as iCalendar (RFC 5545), which is
// what Google Calendar, Apple Calendar and Outlook all read when someone
// subscribes by link. Written by hand — it's a few dozen lines of text and
// not worth a dependency.
//
// Everything here is formatting. Who gets which rows is decided in
// src/routes/calendarRoutes.js; this only turns them into text.

import { CLUB_TZ, clubInstant } from './clubTime.js'

// What the calendar is called in whatever app it's added to, and its colour —
// Google's "Radicchio". Apple honours the colour; Google picks its own for a
// calendar added by link, so the subscribe popup tells people how to set it.
export const CALENDAR_NAME = 'Elemental Beauty'
export const CALENDAR_COLOR = '#AD1457'

// Stable per row, so an edited event moves in place in the subscriber's
// calendar rather than turning up twice. Deliberately not built on APP_URL:
// moving the site mustn't change every UID.
const UID_DOMAIN = 'elemental-beauty'

const HOUR = 60 * 60 * 1000

// TEXT values escape backslash, semicolon and comma, and carry newlines as \n.
export function escapeText(value) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
}

// Lines are at most 75 octets; longer ones continue on the next line after a
// single space. Counted in UTF-8 bytes, and only ever cut between characters,
// so an emoji in a title is never split in half.
export function foldLine(line) {
    const out = []
    let current = ''
    let bytes = 0
    for (const char of line) {
        const size = Buffer.byteLength(char)
        // the first line has 75 to fill; each continuation loses one to its space
        const limit = out.length === 0 ? 75 : 74
        if (bytes + size > limit) {
            out.push(current)
            current = ''
            bytes = 0
        }
        current += char
        bytes += size
    }
    out.push(current)
    return out.join('\r\n ')
}

// 20261001T213000Z
function utcStamp(at) {
    return at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// '2026-10-01' -> '20261001', and the day after it for an all-day DTEND
const dateValue = (day) => day.replace(/-/g, '')
function nextDay(day) {
    const at = new Date(`${day}T00:00:00.000Z`)
    at.setUTCDate(at.getUTCDate() + 1)
    return at.toISOString().slice(0, 10)
}

// One entry's VEVENT lines. `entry` is
//   { uid, title, day: 'YYYY-MM-DD', startTime, endTime, location, description, url }
// with times as 'HH:MM' on the club's clock (or null for an all-day one).
function eventLines(entry, stamp) {
    const lines = ['BEGIN:VEVENT', `UID:${entry.uid}@${UID_DOMAIN}`, `DTSTAMP:${stamp}`]

    if (entry.startTime) {
        const start = clubInstant(entry.day, entry.startTime)
        // no end time on it: an hour, which is what calendar apps assume anyway
        const end = entry.endTime ? clubInstant(entry.day, entry.endTime) : new Date(start.getTime() + HOUR)
        lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`)
    } else {
        lines.push(`DTSTART;VALUE=DATE:${dateValue(entry.day)}`, `DTEND;VALUE=DATE:${dateValue(nextDay(entry.day))}`)
    }

    lines.push(`SUMMARY:${escapeText(entry.title)}`)
    if (entry.location) { lines.push(`LOCATION:${escapeText(entry.location)}`) }
    if (entry.description) { lines.push(`DESCRIPTION:${escapeText(entry.description)}`) }
    if (entry.url) { lines.push(`URL:${entry.url}`) }
    lines.push('END:VEVENT')
    return lines
}

// The whole file, CRLF line endings and folded, for a list of entries. An
// empty list is still a valid calendar — that's what someone gets once
// nothing on it is theirs to see, so their copy empties out rather than
// keeping what it had.
export function buildCalendar(entries, now = new Date()) {
    const stamp = utcStamp(now)
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Elemental Beauty//Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `NAME:${CALENDAR_NAME}`,
        `X-WR-CALNAME:${CALENDAR_NAME}`,
        `X-WR-TIMEZONE:${CLUB_TZ}`,
        `COLOR:${CALENDAR_COLOR}`,
        `X-APPLE-CALENDAR-COLOR:${CALENDAR_COLOR}`,
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H',
    ]
    for (const entry of entries) { lines.push(...eventLines(entry, stamp)) }
    lines.push('END:VCALENDAR')
    return lines.map(foldLine).join('\r\n') + '\r\n'
}
