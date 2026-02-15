import React from 'react';
import { Outlet } from 'react-router-dom';

const Layout = () => {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <main className="container mx-auto p-4">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
