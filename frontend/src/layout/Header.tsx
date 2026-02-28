import React, { useEffect, useState } from 'react';
import { Shield, Search, BellRing, ChevronRight } from 'lucide-react';
import { socket } from '../socket';

export const Header: React.FC = () => {
    const [version, setVersion] = useState<string>('v1.0.0');
    const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
    const [pendingUpdate, setPendingUpdate] = useState<any>(null);

    useEffect(() => {
        // Fetch current version
        const fetchVersion = async () => {
            try {
                // Hardcoding localhost:5000 for local dev if reverse proxy fails, otherwise handle via env
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const token = localStorage.getItem('token'); // Prepare for Auth implementation
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                const res = await fetch(`${apiUrl}/system/version/latest`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setVersion(data.currentVersion);
                }
            } catch (err) {
                console.error("Failed to fetch system version", err);
            }
        };

        fetchVersion();

        // Listen for new updates
        socket.on('system:update_available', (versionData: any) => {
            setPendingUpdate(versionData);
            setUpdateAvailable(true);
        });

        return () => {
            socket.off('system:update_available');
        };
    }, []);

    return (
        <header className="h-16 border-b border-primary/20 bg-background-dark/80 backdrop-blur-md flex items-center justify-between px-6 z-50 shrink-0">
            {/* Logo Area */}
            <div className="flex items-center gap-4">
                <div className="relative size-8 flex items-center justify-center">
                    <div className="absolute inset-0 border border-primary rotate-45"></div>
                    <div className="absolute inset-2 bg-primary/20 rotate-45"></div>
                    <Shield className="text-primary relative z-10 w-5 h-5" />
                </div>
                <h1 className="font-display font-bold text-2xl tracking-wider text-white">
                    NEON <span className="text-primary">GUARDIAN</span>
                </h1>
            </div>

            {/* System Status & Version Tracking */}
            <div className="flex items-center gap-6 flex-1 justify-center max-w-xl mx-auto">
                <div className="hidden lg:flex items-center gap-4 bg-slate-900/50 border border-slate-700/50 rounded-full px-4 py-1.5 transition-all">
                    <span className="text-xs font-mono text-slate-400">SYSTEM VERSION:</span>
                    <span className="text-sm font-mono text-primary font-bold">{version}</span>

                    {updateAvailable && (
                        <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-warning/20 border border-warning/50 rounded-full animate-pulse cursor-pointer hover:bg-warning/30 transition-colors">
                            <BellRing className="w-4 h-4 text-warning" />
                            <span className="text-xs font-bold text-warning tracking-wider">UPDATE AVAILABLE: {pendingUpdate?.versionNumber}</span>
                            <ChevronRight className="w-4 h-4 text-warning" />
                        </div>
                    )}
                </div>
            </div>

            {/* Profile */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-success/10 border border-success/20">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    <span className="text-success text-xs font-bold tracking-widest font-mono">SYSTEM ONLINE</span>
                </div>
                <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                    <div className="text-right hidden md:block">
                        <div className="text-sm font-medium text-white font-display">CMDR. A. VANCE</div>
                        <div className="text-xs text-primary font-mono">LVL 4 CLEARANCE</div>
                    </div>
                    <div
                        className="size-10 rounded bg-slate-800 border border-slate-700 bg-cover bg-center"
                        style={{
                            backgroundImage: 'url("https://ui-avatars.com/api/?name=A+Vance&background=0D8ABC&color=fff")'
                        }}
                    ></div>
                </div>
            </div>
        </header>
    );
};
