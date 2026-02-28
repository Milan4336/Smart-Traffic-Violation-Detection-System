import React, { useEffect, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { Globe, Video } from 'lucide-react';

export const Grid: React.FC = () => {
    const [cameras, setCameras] = useState<any[]>([]);
    const [liveAlerts, setLiveAlerts] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

                const [camerasRes, violationsRes] = await Promise.all([
                    fetch(`${apiUrl}/cameras`, { headers }),
                    fetch(`${apiUrl}/violations?limit=25`, { headers })
                ]);

                if (camerasRes.ok) setCameras(await camerasRes.json());
                if (violationsRes.ok) {
                    const data = await violationsRes.json();
                    setLiveAlerts(data.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch grid data", err);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="font-display font-bold text-2xl text-white uppercase tracking-widest flex items-center gap-3">
                        <Globe className="text-primary w-6 h-6" /> GLOBAL GRID MONITOR
                    </h2>
                    <p className="text-slate-400 font-mono text-sm mt-1">Full-spectrum geospatial mapping of all active Neon Guardian camera nodes.</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-sm">
                        <Video className="w-4 h-4 text-primary" /> {cameras.length} NODES
                    </div>
                </div>
            </div>

            <div className="flex-1 rounded-xl border border-primary/20 overflow-hidden relative shadow-[0_0_30px_rgba(0,240,255,0.05)]">
                <LiveMap cameras={cameras} violations={liveAlerts} />
                {/* Map Overlay Frame */}
                <div className="absolute inset-0 border-[4px] border-white/5 pointer-events-none rounded-xl"></div>
                <div className="absolute top-4 left-4 bg-background-dark/80 backdrop-blur border border-primary/30 p-3 rounded font-mono text-xs z-[400]">
                    <div className="text-primary font-bold mb-2">MATRIX LEGEND</div>
                    <div className="flex items-center gap-2 mb-1"><span className="size-2 rounded-full bg-primary shadow-neon"></span> <span className="text-slate-300">ACTIVE CAMERA</span></div>
                    <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-alert shadow-neon-alert"></span> <span className="text-slate-300">DETECTED THREAT</span></div>
                </div>
            </div>
        </div>
    );
};
