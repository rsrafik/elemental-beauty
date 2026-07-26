// Shown to officer / treasurer / admin. Its own layout — design freely.
import StatCard from '@/components/dashboards/StatCard'
import Leaderboard from '@/components/dashboards/Leaderboard'

// Placeholder standings until the backend feeds real point totals.
const LEADERBOARD = [
    { name: 'Michelle C.', points: 52 },
    { name: 'Azu N.', points: 48 },
    { name: 'Rachel R.', points: 33 },
    { name: 'Aiden T.', points: 27 },
    { name: 'Yo Mama', points: 15 },
    { name: 'T. Fushiguro', points: 10 },
]

export default function OfficerDashboard() {
    return (
        <main className="
            bg-cream 
            w-screen 
            h-screen
            flex
            flex-col
            items-center
            justify-center
        ">
            <div className="
                relative
                w-screen
                max-w-[800px]
                mb-[75px]
            ">
                <div className="
                    bg-salmon
                    w-full
                    h-[150px]
                    rounded-[25px]
                    border-3
                    border-dark-red
                "/>
                <div className="
                    absolute
                    top-1/2
                    left-0
                    -translate-x-1/2
                    -translate-y-1/2
                    size-47
                    rounded-full
                    bg-slate-300
                    border-3
                    border-dark-red
                    z-10
                "/>
            </div>
            
            <h1 className="
                title-gradient
                font-bumbel
                text-[86px]
                leading-none
                text-center
            ">
                Dashboard
            </h1>
            
            <div className="
                w-full
                max-w-[1300px]
                px-8
                mt-12
                grid
                grid-cols-[1fr_auto_1fr]
                items-start
                gap-16
            ">
                {/* Members column */}
                <div className="flex flex-col items-center gap-4 w-[260px] justify-self-end">
                    <button className="
                        text-cream
                        bg-terracotta
                        py-[10px]
                        px-10
                        font-beachday
                        text-[25px]
                        rounded-[10px]
                        shadow-[-4px_4px_0_rgba(0,0,0,0.35)]
                        transition-transform
                        duration-150
                        hover:-translate-y-0.5
                        active:scale-95
                        cursor-pointer
                    ">
                        Email All
                    </button>

                    <StatCard
                        label="Total Members"
                        value={6}
                        className="w-full"
                    />
                </div>

                {/* Suggested Actions column */}
                <div className="flex flex-col items-center gap-4 w-[400px]">
                    <h2 className="
                        text-dark-red
                        font-starbim
                        text-[30px]
                        text-center
                        whitespace-nowrap
                    ">
                        Suggested Actions
                    </h2>

                    <div className="
                        w-full
                        rounded-[18px]
                        border-3
                        border-dark-red
                        overflow-hidden
                        bg-gradient-to-b
                        from-salmon
                        via-peach
                        to-mustard
                        divide-y-2
                        divide-dark-red/40
                    ">
                        <ActionButton>Make Announcement</ActionButton>
                        <ActionButton>Create Lab</ActionButton>
                        <ActionButton>Create Event</ActionButton>
                    </div>
                </div>

                {/* Leaderboard column */}
                <div className="flex w-[360px] justify-self-start">
                    <Leaderboard entries={LEADERBOARD} />
                </div>
            </div>
            
        </main>
    )
}

// One row in the Suggested Actions stack. The whole row lights up on hover
// and a chevron slides in from the right.
function ActionButton({ children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="
                group
                relative
                w-full
                py-4
                px-6
                flex
                items-center
                justify-center
                font-serif
                font-semibold
                text-black
                text-[20px]
                tracking-wide
                transition-all
                duration-200
                hover:bg-cream/25
                hover:tracking-wider
                active:scale-[0.97]
                cursor-pointer
            "
        >
            <span className="
                transition-transform
                duration-200
                group-hover:-translate-x-2
            ">
                {children}
            </span>
            <span className="
                absolute
                right-5
                opacity-0
                -translate-x-2
                transition-all
                duration-200
                group-hover:opacity-100
                group-hover:translate-x-0
            ">
                →
            </span>
        </button>
    )
}
