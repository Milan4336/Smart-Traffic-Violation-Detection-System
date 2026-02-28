import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Table, LineChart, Settings } from 'lucide-react';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
    const navItems = [
        { name: 'CMD', icon: LayoutDashboard, path: '/' },
        { name: 'GRID', icon: Map, path: '/live-monitoring' },
        { name: 'LOGS', icon: Table, path: '/violations' },
        { name: 'STATS', icon: LineChart, path: '/analytics' },
        { name: 'PATCHES', icon: Settings, path: '/system' },
    ];

    return (
        <aside className="w-20 bg-background-dark border-r border-primary/10 flex flex-col items-center py-6 gap-6 z-40 shrink-0">
            <nav className="flex flex-col gap-4 w-full px-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) => clsx(
                            "group flex flex-col items-center gap-1 p-2 rounded hover:bg-white/5 relative transition-colors",
                            isActive ? "text-primary" : "text-slate-500 hover:text-white"
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                <div className={clsx(
                                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r shadow-neon transition-opacity",
                                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}></div>
                                <item.icon className={clsx("w-7 h-7 mb-1", isActive ? "text-primary" : "")} />
                                <span className="text-[10px] font-display font-semibold tracking-wider">{item.name}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
            <div className="mt-auto flex flex-col gap-4 w-full px-2">
                {/* Reserved for bottom aligned items */}
            </div>
        </aside>
    );
};
