import { readMessage } from './emailAll.js'

// The check-in page's "email unpaid" and "confirmation" open with the email
// they'd send already written in (GET .../draft), and the officer can change
// it before it goes. What comes back is the same subject and message box as
// "email all", with a few placeholders that are filled in for each person:
//
//   {first name}   their first name (left out, with the space before it, if
//                  they have none: "Hi {first name}," -> "Hi,")
//   {deadline}     the confirmation's confirm-by date and time
//   {due date}     their payment due date
//
// The parts that differ from person to person and mustn't be lost stay
// outside the box: the big due-date callout, their own button (a confirm
// link is signed for each person), the attachments and the small print.
//
// When the box comes back as it was opened, nothing custom is sent at all and
// everyone gets the email tailored to where they stand, as before — an
// overdue reminder still says it's overdue.

export const PLACEHOLDERS = ['{first name}', '{deadline}', '{due date}']

const NAMES = { 'first name': 'firstName', deadline: 'deadline', 'due date': 'dueDate' }

export function fillDraft(text, values) {
    return String(text).replace(/( ?)\{(first name|deadline|due date)\}/gi, (match, space, name) => {
        const value = values[NAMES[name.toLowerCase()]]
        return value ? `${space}${value}` : ''
    })
}

// A custom email from the request body, or null when none was sent (the
// default goes out). Returns { custom } or { error }.
export function readDraft(body) {
    if (body?.subject === undefined && body?.message === undefined) { return { custom: null } }
    const { subject, message, error } = readMessage(body)
    return error ? { error } : { custom: { subject, message } }
}
