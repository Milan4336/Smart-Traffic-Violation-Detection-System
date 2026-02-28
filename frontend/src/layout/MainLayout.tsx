import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const MainLayout: React.FC = () => {
    return (
        <div className="flex flex-col h-screen bg-background-dark text-white font-body overflow-hidden">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-hidden relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
