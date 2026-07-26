// Mustard stat tile with a drop shadow. Shared across dashboards.
// `label` is the caption, `value` is the big number/text below it.
export default function StatCard({ label, value, className = '' }) {
    return (
        <div className={`
            relative
            z-20
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
            ${className}
        `}>
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
                text-5xl
            ">
                {value}
            </p>
        </div>
    )
}
