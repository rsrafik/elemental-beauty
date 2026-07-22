export default function OnboardingDashboard() {
    return (
        <main className="
            bg-cream
            w-full
            min-h-screen
            flex
            items-center
            justify-center
            py-10
        ">
            <div className="
                relative
                flex
                flex-col
                lg:flex-row
                items-center
                justify-center
                gap-8
                lg:gap-[75px]
                w-full
                px-8
            ">
                <h1 className="
                    relative
                    lg:absolute
                    lg:bottom-full
                    lg:left-1/2
                    lg:-translate-x-1/2
                    lg:mb-6
                    whitespace-nowrap
                    title-gradient
                    font-bumbel
                    text-[70px]
                    lg:text-[80px]
                ">
                    To-Do List
                </h1>
                <div className="
                    w-full
                    max-w-[400px]
                    lg:flex-1
                    h-[360px]
                    lg:h-125
                    bg-mustard
                    rounded-[1vw]
                    mt-5
                    border-dark-red
                    border-3
                    flex
                    flex-col
                    items-center
                    justify-between
                    p-8
                ">
                    <svg
                        viewBox="0 0 477 512.52"
                        className="
                            size-14
                            lg:size-20
                            fill-red-500
                        "
                    >
                        <path d="M366.76 187.48c-24.98 25.29-46.02 46.99-64.72 66.79 41.13 47.31 82.57 91.21 159.57 160.49 10.58 9.53 16.35 18.16 15.26 26.89-1.12 9.04-8.97 16.04-25.51 21.43l-.53.14c-105.32 34.1-91.93 13.16-158.67-68.88-21.91-24.68-40.46-46.19-57.13-65.72-37.96 44.38-74.46 91.2-133.98 166.85-8.81 11.19-17.05 17.5-25.83 17.01-9.1-.52-16.59-7.9-23.06-24.05l-.18-.52c-40.96-102.85-19.2-90.84 58.26-162.87 24.98-25.29 46.02-46.99 64.72-66.79-41.13-47.31-82.57-91.21-159.57-160.49C4.81 88.23-.96 79.6.13 70.87c1.12-9.04 8.97-16.04 25.51-21.43l.53-.14c105.32-34.11 91.93-13.16 158.67 68.88 21.9 24.68 40.46 46.19 57.13 65.72 37.96-44.38 74.46-91.2 133.98-166.85C384.76 5.86 393-.45 401.78.04c9.1.52 16.59 7.9 23.06 24.05l.18.52c40.96 102.85 19.2 90.84-58.26 162.87z" />
                    </svg>
                    <h1 className="
                        font-beachday
                        text-[45px]
                        lg:text-[60px]
                        text-black
                        text-center
                        leading-none
                    ">
                        Verify Account
                    </h1>
                    <button type="button" className="
                        bg-salmon
                        px-7
                        py-2
                        rounded-full
                        font-cause
                        text-black
                        font-bold
                        text-[18px]
                        lg:text-[20px]
                    ">
                        RESEND EMAIL
                    </button>
                </div>
                <div className="
                    w-full
                    max-w-[400px]
                    lg:flex-1
                    h-[360px]
                    lg:h-125
                    bg-salmon
                    rounded-[1vw]
                    mt-5
                    border-dark-red
                    border-3
                    flex
                    flex-col
                    items-center
                    justify-between
                    p-8
                ">
                    <svg
                        viewBox="0 0 477 512.52"
                        className="
                            size-14
                            lg:size-20
                            fill-red-500
                        "
                    >
                        <path d="M366.76 187.48c-24.98 25.29-46.02 46.99-64.72 66.79 41.13 47.31 82.57 91.21 159.57 160.49 10.58 9.53 16.35 18.16 15.26 26.89-1.12 9.04-8.97 16.04-25.51 21.43l-.53.14c-105.32 34.1-91.93 13.16-158.67-68.88-21.91-24.68-40.46-46.19-57.13-65.72-37.96 44.38-74.46 91.2-133.98 166.85-8.81 11.19-17.05 17.5-25.83 17.01-9.1-.52-16.59-7.9-23.06-24.05l-.18-.52c-40.96-102.85-19.2-90.84 58.26-162.87 24.98-25.29 46.02-46.99 64.72-66.79-41.13-47.31-82.57-91.21-159.57-160.49C4.81 88.23-.96 79.6.13 70.87c1.12-9.04 8.97-16.04 25.51-21.43l.53-.14c105.32-34.11 91.93-13.16 158.67 68.88 21.9 24.68 40.46 46.19 57.13 65.72 37.96-44.38 74.46-91.2 133.98-166.85C384.76 5.86 393-.45 401.78.04c9.1.52 16.59 7.9 23.06 24.05l.18.52c40.96 102.85 19.2 90.84-58.26 162.87z" />
                    </svg>
                    <h1 className="
                        font-beachday
                        text-[45px]
                        lg:text-[60px]
                        text-black
                        text-center
                        leading-none
                    ">
                        Sign Waiver
                    </h1>
                    <button type="button" className="
                        bg-mustard
                        px-7
                        py-2
                        rounded-full
                        font-cause
                        text-black
                        font-bold
                        text-[18px]
                        lg:text-[20px]
                    ">
                        SIGN HERE
                    </button>
                </div>
            </div>
        </main>
    )
}
