import React from 'react';
import { twMerge } from 'tailwind-merge';

const Button = ({ children, className, variant = 'primary', ...props }) => {
    const baseStyles = "px-6 py-3 rounded-2xl font-semibold transition-colors duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

    const variants = {
        primary: "bg-slate-800 text-white hover:bg-slate-900",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
        danger: "bg-red-50 text-red-600 hover:bg-red-100",
        ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
        glass: "bg-white/70 border border-white/50 text-slate-800 hover:bg-white/80"
    };

    return (
        <button
            className={twMerge(baseStyles, variants[variant], className)}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
