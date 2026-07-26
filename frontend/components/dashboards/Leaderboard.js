// Leaderboard card for the officer dashboard. `entries` is an ordered list
// of { name, points }; rank is derived from position. Top 3 get medals.
const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ entries = [] }) {
    return (
        <div className="
            w-full
            max-w-[360px]
            rounded-[18px]
            overflow-hidden
            border-3
            border-black
            bg-mustard
            shadow-[-6px_6px_0_rgba(0,0,0,0.85)]
        ">
            {/* Header banner */}
            <h2 className="
                bg-gold
                border-b-3
                border-black
                text-dark-red
                font-beachday
                text-[34px]
                tracking-wide
                text-center
                py-2
                drop-shadow-[-2px_2px_0_rgba(0,0,0,0.25)]
            ">
                Leaderboard
            </h2>

            {/* Rows */}
            <ol className="divide-y-2 divide-dark-red/40">
                {entries.map((entry, i) => (
                    <li
                        key={entry.name}
                        className="
                            group
                            grid
                            grid-cols-[56px_1fr_auto]
                            items-center
                            transition-colors
                            duration-200
                            hover:bg-gold/40
                        "
                    >
                        {/* Rank */}
                        <span className="
                            flex
                            items-center
                            justify-center
                            text-[24px]
                            font-beachday
                            text-dark-red
                        ">
                            {MEDALS[i] ?? `${i + 1}.`}
                        </span>

                        {/* Name */}
                        <span className="
                            py-3
                            font-serif
                            text-black
                            text-[22px]
                            transition-transform
                            duration-200
                            group-hover:translate-x-1
                        ">
                            {entry.name}
                        </span>

                        {/* Points */}
                        <span className="
                            flex
                            items-center
                            justify-center
                            min-w-[56px]
                            self-stretch
                            border-l-2
                            border-dark-red/40
                            font-beachday
                            text-dark-red
                            text-[22px]
                        ">
                            {entry.points}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    )
}
