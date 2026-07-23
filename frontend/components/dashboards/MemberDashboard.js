// Shown to a member (role = 'member'). Its own layout — design freely.
import WeekStrip from '@/components/dashboards/WeekStrip'

export default function MemberDashboard() {
    return (
        <main className="
            bg-cream
            w-full
            min-h-screen
            flex
            items-center
            justify-center
            p-8
        ">
            {/* Outer column: the two-up row on top, week strip full width below. */}
            <div className="
                w-full
                max-w-[1440px]
                flex
                flex-col
                gap-10
            ">
                <div className="
                    w-full
                    flex
                    flex-col
                    lg:flex-row
                    items-center
                    lg:items-start
                    gap-10
                    lg:gap-14
                ">
                    <div className="
                        relative
                        w-full
                        max-w-[520px]
                        lg:flex-[4]
                        pt-24
                    ">
                        <div className="
                            absolute
                            top-0
                            left-1/2
                            -translate-x-1/2
                            size-44
                            rounded-full
                            bg-slate-300
                            border-3
                            border-black
                            z-10
                        " />

                        <div className="
                            bg-pink
                            border-3
                            border-dark-red/50
                            rounded-2xl
                            pt-28
                            pb-8
                            px-10
                            flex
                            flex-col
                            gap-5
                        ">
                            <h2 className="
                                font-ettamelody
                                text-dark-red
                                text-[72px]
                                leading-[0.9]
                            ">
                                Welcome back,
                            </h2>
                            <h3 className="
                                self-center
                                font-sans
                                font-light
                                text-black
                                text-[66px]
                                leading-none
                            ">
                                Azu
                            </h3>
                            <button type="button" className="
                                self-center
                                bg-terracotta
                                text-cream
                                font-beachday
                                font-bold
                                text-base
                                text-[20px]
                                tracking-wide
                                px-8
                                py-1
                                rounded-[10px]
                                shadow-[-3px_3px_3px_rgba(0,0,0,0.48)]
                            ">
                                SHOW QR CODE
                            </button>
                        </div>
                    </div>

                    <div className="
                        w-full
                        lg:flex-[5]
                        flex
                        flex-col
                        gap-8
                    ">
                        <h1 className="
                            title-gradient
                            font-bumbel
                            text-[86px]
                            leading-none
                            text-center
                        ">
                            Dashboard
                        </h1>

                        <section className="
                            border-3
                            border-dark-red
                            rounded-sm
                            overflow-hidden
                        ">
                            <h2 className="
                                bg-peach-light
                                border-b-3
                                border-dark-red
                                text-dark-red
                                font-serif
                                font-bold
                                text-base
                                tracking-widest
                                text-center
                                py-1.5
                            ">
                                ANNOUNCEMENTS
                            </h2>
                            <div className="
                                bg-peach
                                px-8
                                py-10
                            ">
                                <p className="
                                    font-serif
                                    text-black
                                    text-4xl
                                ">
                                    Welcome to Elemental Beauty!
                                </p>
                            </div>
                        </section>

                        <section className="
                            flex
                            items-center
                            justify-center
                        ">
                            <StatCard label="Past Labs" value={4} />
                            <img
                                src="/cloud-1.png"
                                alt="20 points"
                                className="
                                    w-[38%]
                                    shrink-0
                                    -mx-8
                                    z-10
                                    drop-shadow-md
                                "
                            />
                            <StatCard label="Past Events" value={12} />
                        </section>
                    </div>
                </div>

                {/* Week strip spans the full width, under both columns. */}
                <WeekStrip />
            </div>
        </main>
    )
}

function StatCard({ label, value }) {
    return (
        <div className="
            flex-1
            min-w-0
            bg-mustard
            border-3
            border-black
            rounded-xl
            shadow-[-6px_6px_0_rgba(0,0,0,0.85)]
            flex
            flex-col
            items-center
            justify-center
            gap-2
            px-4
            py-12
        ">
            <h3 className="
                font-starbim
                text-dark-red
                text-3xl
                text-center
                text-balance
                leading-tight
            ">
                {label}
            </h3>
            <p className="
                font-serif 
                text-black 
                text-5xl">
                {value}
            </p>
        </div>
    )
}
