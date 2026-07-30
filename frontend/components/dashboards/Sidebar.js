'use client'

// Reusable sidebar template used across (almost) all dashboard views.
//
// Just give it a list of button labels — numbers auto-increment (01, 02, ...),
// the active one renders as the tall white card, the rest as yellow pills.
// Which labels you pass in is up to the caller, so each role (user / member /
// officer) can show a different set of buttons.
//
//   <Sidebar
//     items={['dashboard', 'labs', 'events', 'calendar']}
//     active="dashboard"
//     onSelect={(label, i) => ...}
//     showInstagram
//   />
//
// `active` may be the label string or the index. `titleFont` swaps the
// display font on the "menu" heading (default --font-bumbel).

function UserIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18.5a6 6 0 0 1 11 0" />
    </svg>
  )
}

function LogoutIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  )
}

export default function Sidebar({
  items = [],
  active = 0,
  onSelect,
  showInstagram = true,
  instagramUrl = 'https://instagram.com/elementist_',
  onProfile,
  onLogout,
  titleFont = 'font-reasons',
  className = '',
}) {
  const isActive = (label, i) =>
    typeof active === 'number' ? active === i : active === label

  return (
    <aside
      className={`bg-orange rounded-[10px] p-4 flex flex-col gap-3 w-[327px] min-h-full font-vietnam ${className}`}
    >
      <h2 className={`${titleFont} text-black text-4xl text-center py-5 select-none`}>
        MENu
      </h2>

      <nav className="flex flex-col gap-3">
        {items.map((label, i) => {
          const activeItem = isActive(label, i)
          const number = String(i + 1).padStart(2, '0')
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect?.(label, i)}
              aria-current={activeItem ? 'page' : undefined}
              className={`group flex items-center justify-between rounded-[5px] px-4 text-left
                font-vietnam font-semibold text-black
                transition-all duration-200 ease-out
                hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10
                active:translate-y-0 active:shadow-none
                ${activeItem
                  ? 'bg-white h-28 items-start pt-4 shadow-sm'
                  : 'bg-yellow-light h-14 hover:bg-yellow'}`}
            >
              <span className="text-lg transition-transform duration-200 ease-out
                group-hover:translate-x-0.5">{label}</span>
              <span
                className={`flex items-center justify-center rounded-full text-xs w-7 h-7 shrink-0
                  transition-transform duration-200 ease-out group-hover:scale-110
                  ${activeItem ? 'bg-yellow' : 'bg-white'}`}
              >
                {number}
              </span>
            </button>
          )
        })}
      </nav>

      {/* bottom cluster: profile + logout, then optional instagram banner */}
      <div className="mt-auto flex flex-col gap-3 pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onProfile}
            className="group flex items-center gap-2 flex-1 bg-white rounded-[5px] px-4 h-14
              font-vietnam font-semibold text-black
              transition-all duration-200 ease-out
              hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10
              active:translate-y-0 active:shadow-none"
          >
            <UserIcon className="w-5 h-5 transition-transform duration-200 ease-out
              group-hover:scale-110 group-hover:-rotate-6" />
            <span className="text-lg transition-transform duration-200 ease-out
              group-hover:translate-x-0.5">profile</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            className="group flex items-center justify-center bg-red rounded-[5px] w-12 h-14
              text-white transition-all duration-200 ease-out
              hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 hover:brightness-95
              active:translate-y-0 active:shadow-none"
          >
            <LogoutIcon className="w-5 h-5 transition-transform duration-200 ease-out
              group-hover:translate-x-0.5" />
          </button>
        </div>

        {showInstagram && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[5px] h-[101px] flex items-center justify-center text-center
              text-white text-[38px] font-aalto tracking-wide uppercase
              bg-[linear-gradient(90deg,#FFDF2B_0%,#FF7D45_20%,#FF1919_45%,#C13584_75%,#833AB4_100%)]
              transition-all duration-200 ease-out
              hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 hover:brightness-105
              active:translate-y-0 active:shadow-none"
          >
            Follow us on Instagram
          </a>
        )}
      </div>
    </aside>
  )
}
