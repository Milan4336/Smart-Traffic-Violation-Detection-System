import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    Bell,
    Bot,
    Camera,
    Database,
    LogOut,
    Search,
    Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { socket } from '../socket';
import { useSystemStatus, type HealthState } from '../contexts/SystemStatusContext';

const statusToneClass: Record<HealthState, string> = {
    HEALTHY: 'text-emerald-300',
    DEGRADED: 'text-amber-300',
    OFFLINE: 'text-red-300',
    STARTING: 'text-sky-300'
};

const statusDotClass: Record<HealthState, string> = {
    HEALTHY: 'bg-emerald-400',
    DEGRADED: 'bg-amber-400',
    OFFLINE: 'bg-red-400',
    STARTING: 'bg-sky-400'
};

const formatStatusTooltip = (status: HealthState, detail: string, latencyMs: number | null): string => {
    if (latencyMs === null) {
        return `${status} • ${detail}`;
    }
    return `${status} • ${detail} • ${latencyMs}ms`;
};

export const Header: React.FC = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { snapshot } = useSystemStatus();
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [pendingVersion, setPendingVersion] = useState<string | null>(null);
    const [quickSearch, setQuickSearch] = useState('');

    useEffect(() => {
        const handleUpdate = (payload: unknown) => {
            const parsed = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
            const version = String(parsed.versionNumber || parsed.version || 'NEW');
            setPendingVersion(version);
            setUpdateAvailable(true);
        };

        socket.on('system:update_available', handleUpdate);
        return () => {
            socket.off('system:update_available', handleUpdate);
        };
    }, []);

    const handleQuickSearchSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!quickSearch.trim()) return;
        navigate(`/violations?plate_number=${encodeURIComponent(quickSearch.trim())}`);
    };

    const statusIcons = [
        {
            label: 'System',
            icon: Activity,
            status: snapshot.services.system.status,
            tooltip: formatStatusTooltip(
                snapshot.services.system.status,
                snapshot.services.system.detail,
                snapshot.services.system.latencyMs
            )
        },
        {
            label: 'AI',
            icon: Bot,
            status: snapshot.services.ai.status,
            tooltip: formatStatusTooltip(
                snapshot.services.ai.status,
                snapshot.services.ai.detail,
                snapshot.services.ai.latencyMs
            )
        },
        {
            label: 'Cameras',
            icon: Camera,
            status: snapshot.services.cameras.status,
            tooltip: formatStatusTooltip(
                snapshot.services.cameras.status,
                snapshot.services.cameras.detail,
                snapshot.services.cameras.latencyMs
            )
        },
        {
            label: 'Database',
            icon: Database,
            status: snapshot.services.database.status,
            tooltip: formatStatusTooltip(
                snapshot.services.database.status,
                snapshot.services.database.detail,
                snapshot.services.database.latencyMs
            )
        }
    ];

    return (
        <header className="h-16 border-b border-primary/20 bg-background-dark/90 backdrop-blur-md flex items-center gap-4 px-4 md:px-6 z-50 shrink-0 sticky top-0">
            <button
                type="button"
                className="flex items-center gap-3 shrink-0"
                onClick={() => navigate('/')}
            >
                <span className="relative size-8 flex items-center justify-center">
                    <span className="absolute inset-0 border border-primary rotate-45" />
                    <span className="absolute inset-2 bg-primary/20 rotate-45" />
                    <Shield className="text-primary relative z-10 w-5 h-5" />
                </span>
                <span className="hidden md:block font-display font-bold text-xl tracking-widest text-white">
                    NEON <span className="text-primary">GUARDIAN</span>
                </span>
            </button>

            <form
                onSubmit={handleQuickSearchSubmit}
                className="flex-1 max-w-xl hidden lg:flex items-center bg-slate-900/70 border border-slate-700/80 rounded-lg px-3 py-2"
            >
                <Search className="w-4 h-4 text-slate-500 mr-2" />
                <input
                    value={quickSearch}
                    onChange={(event) => setQuickSearch(event.target.value)}
                    placeholder="Quick Search: plate / camera / violation"
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
            </form>

            <div className="hidden xl:flex items-center gap-2">
                {statusIcons.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} className="group relative">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-700 bg-slate-900/70 ${statusToneClass[item.status]}`}>
                                <span className={`w-2 h-2 rounded-full ${statusDotClass[item.status]}`} />
                                <Icon className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-mono uppercase tracking-[0.14em]">{item.label}</span>
                            </div>
                            <div className="pointer-events-none absolute right-0 top-full mt-2 min-w-[220px] rounded border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-mono text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                {item.tooltip}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hidden md:flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] px-2 py-1 rounded border border-slate-700 bg-slate-900/70 text-slate-200">
                    Ver {snapshot.currentVersion}
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-[0.16em] px-2 py-1 rounded border border-slate-700 bg-slate-900/70 ${snapshot.cameraStats.offline > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {snapshot.cameraStats.online} Active
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] px-2 py-1 rounded border border-slate-700 bg-slate-900/70 text-red-300">
                    {snapshot.cameraStats.offline} Offline
                </span>
            </div>

            <button
                type="button"
                onClick={() => navigate('/violations')}
                className="relative p-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-primary hover:border-primary/40 transition-colors"
                title="Notifications"
            >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-alert text-white text-[10px] leading-4 font-mono text-center">
                    {snapshot.activeAlerts}
                </span>
                {updateAvailable && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono uppercase tracking-wider text-warning whitespace-nowrap">
                        {pendingVersion || 'Update'}
                    </span>
                )}
            </button>

            <div className="flex items-center gap-3 pl-3 md:pl-4 border-l border-slate-800 shrink-0">
                <div className="text-right hidden md:block">
                    <p className="text-xs font-semibold text-white uppercase tracking-wider">{user?.name || 'Operator'}</p>
                    <p className="text-[10px] text-primary font-mono uppercase tracking-[0.16em]">
                        {user?.role || 'VIEWER'} • CL-{user?.clearanceLevel || 1}
                    </p>
                </div>
                <span
                    className="size-9 rounded border border-slate-700 bg-cover bg-center"
                    style={{ backgroundImage: `url("https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0D8ABC&color=fff")` }}
                />
                <button
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-alert transition-colors"
                    title="Terminate session"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </header>
    );
};
