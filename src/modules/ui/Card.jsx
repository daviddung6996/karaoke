import { twMerge } from 'tailwind-merge';

const Card = ({ children, className, glass = false, ...props }) => {
    return (
        <div
            className={twMerge(
                "rounded-3xl p-6 transition-shadow duration-200",
                glass
                    ? "bg-white/90 border border-white/60"
                    : "bg-white border border-slate-100",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

export default Card;
