// The advisor role: the club's faculty advisor. They can look at everything an
// admin can — requireRole ranks them alongside admin — and change nothing.
//
// Every request that would change something (anything but GET/HEAD/OPTIONS)
// from an advisor is refused here, in authMiddleware, before any route sees
// it — so a route added later is read-only to them without anyone having to
// remember. The exceptions:
//
//   email-all   the dashboard's club-wide "Email All", and a lab's or event's
//               "email all" to the people signed up for it
//   their own account — their profile and email settings (PUT /members/me),
//               and the /auth routes that are about themselves (resending the
//               verification email, the waiver, deleting their account)
//
// The pages hide the controls an advisor can't use (canChange in
// frontend/lib/roles.js); this is the rule that actually holds.

const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

const ALLOWED = [
    ['POST', /^\/api\/members\/email-all$/],
    ['POST', /^\/api\/(labs|events)\/\d+\/email-all$/],
    ['PUT', /^\/api\/members\/me$/],
    [null, /^\/api\/auth\//],
]

export const ADVISOR_REFUSAL = 'Advisors can view everything but can\u2019t make changes'

export function advisorMayDo(method, url) {
    if (READS.has(method)) { return true }
    const path = url.split('?')[0]
    return ALLOWED.some(([m, pattern]) => (m === null || m === method) && pattern.test(path))
}
