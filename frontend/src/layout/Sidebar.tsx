import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Camera,
    Table,
    LineChart,
    Settings,
    Video,
    Ban,
    Users,
    ClipboardCheck,
    ActivitySquare,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar: React.FC = () => {
    const { user } = useAuth();
    const [collapsed, setCollapsed] = React.useState<boolean>(() => localStorage.getItem('ng:sidebar-collapsed') === '1');

    const role = user?.role.toUpperCase() || 'VIEWER';

    React.useEffect(() => {
        localStorage.setItem('ng:sidebar-collapsed', collapsed ? '1' : '0');
    }, [collapsed]);

    const navSections = [
        {
            title: 'Operations',
            items: [
                { label: 'Dashboard', short: 'DASH', icon: LayoutDashboard, path: '/', roles: ['ADMIN', 'OFFICER', 'ANALYST', 'VIEWER'] },
                { label: 'Live Cameras', short: 'CAMS', icon: Camera, path: '/cameras/grid', roles: ['ADMIN', 'OFFICER', 'ANALYST', 'VIEWER'] },
                { label: 'Violations', short: 'LOGS', icon: Table, path: '/violations', roles: ['ADMIN', 'OFFICER', 'ANALYST', 'VIEWER'] },
                { label: 'Review Queue', short: 'REVIEW', icon: ClipboardCheck, path: '/violations/review', roles: ['ADMIN', 'OFFICER'] }
            ]
        },
        {
            title: 'Intelligence',
            items: [
                { label: 'Video Processing', short: 'VIDEO', icon: Video, path: '/videos', roles: ['ADMIN', 'OFFICER', 'ANALYST', 'VIEWER'] },
                { label: 'Analytics', short: 'STATS', icon: LineChart, path: '/analytics', roles: ['ADMIN', 'OFFICER', 'ANALYST', 'VIEWER'] },
                { label: 'System Status', short: 'STATUS', icon: ActivitySquare, path: '/system-status', roles: ['ADMIN', 'OFFICER', 'ANALYST', 'VIEWER'] },
                { label: 'System Updates', short: 'UPDATES', icon: Settings, path: '/system-updates', roles: ['ADMIN', 'OFFICER', 'ANALYST', 'VIEWER'] }
            ]
        },
        {
            title: 'Administration',
            items: [
                { label: 'Users', short: 'USERS', icon: Users, path: '/admin/users', roles: ['ADMIN'] },
                { label: 'Blacklist', short: 'BLACKLIST', icon: Ban, path: '/admin/blacklist', roles: ['ADMIN', 'OFFICER'] },
                { label: 'Release Admin', short: 'PATCH', icon: Settings, path: '/admin/system-updates', roles: ['ADMIN'] }
            ]
        }
    ].map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles.includes(role))
    })).filter((section) => section.items.length > 0);

    return (
        <aside className={clsx(
            'bg-background-dark border-r border-primary/10 flex flex-col py-4 gap-4 z-40 shrink-0 transition-all duration-200',
            collapsed ? 'w-20' : 'w-72'
        )}>
            <div className={clsx('px-3 flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
                {!collapsed && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Navigation</p>
                )}
                <button
                    type="button"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    onClick={() => setCollapsed((value) => !value)}
                    className="p-2 rounded border border-slate-700 bg-slate-900/60 text-slate-300 hover:text-primary hover:border-primary/50 transition-colors"
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 pb-3">
                {navSections.map((section) => (
                    <div key={section.title} className="mb-4">
                        {!collapsed && (
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono px-3 mb-2">
                                {section.title}
                            </p>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => clsx(
                                        'group relative flex items-center rounded-lg border transition-colors',
                                        collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5 gap-3',
                                        isActive
                                            ? 'bg-primary/12 border-primary/40 text-primary'
                                            : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900/60 hover:text-white'
                                    )}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon className={clsx('shrink-0', collapsed ? 'w-5 h-5' : 'w-5 h-5', isActive && 'text-primary')} />
                                            {!collapsed && (
                                                <span className="text-xs font-medium tracking-wide">{item.label}</span>
                                            )}
                                            {collapsed && (
                                                <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded border border-slate-700 bg-slate-950 text-[10px] font-mono uppercase tracking-wider text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {item.short}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
};
