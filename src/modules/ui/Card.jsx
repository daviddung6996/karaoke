import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Card = ({ children, className, glass = false, ...props }) => {
    return (
        <div
            className={twMerge(
                "rounded-3xl p-6 transition-all duration-300",
                glass
                    ? "bg-white/40 backdrop-blur-xl border border-white/60"
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
