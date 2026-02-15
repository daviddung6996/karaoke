import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Input = ({ className, error, ...props }) => {
    return (
        <div className="w-full">
            <input
                className={twMerge(
                    "w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-inner",
                    error && "border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/50",
                    className
                )}
                {...props}
            />
            {error && <p className="mt-2 text-sm text-red-500 ml-2">{error}</p>}
        </div>
    );
};

export default Input;
