import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Video,
    Shield,
    Activity,
    Map as MapIcon,
    Settings,
    Search,
    Filter,
    ArrowUpRight,
    Wifi
} from 'lucide-react';

export const CameraDirectory: React.FC = () => {
    const [cameras, setCameras] = useState<any[]>([]);
    const [filter, setFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCameras = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const res = await fetch(`${apiUrl}/cameras`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCameras(data);
                }
            } catch (err) {
                console.error("Failed to fetch cameras", err);
            }
        };
        fetchCameras();
    }, []);

    const filteredCameras = cameras.filter(cam => {
        const matchesSearch = cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cam.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === 'ALL' || cam.status === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="flex flex-col h-full p-6 space-y-6 bg-background-dark overflow-y-auto">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-primary/10 pb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white uppercase tracking-tighter flex items-center gap-3">
                        <Video className="text-primary w-8 h-8" /> Node Matrix
                    </h2>
                    <p className="text-slate-400 font-mono text-sm mt-1">Directory of all active Neon Guardian enforcement nodes and geospatial assets.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/live-monitoring')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors font-mono text-sm"
                    >
                        <MapIcon className="w-4 h-4" /> Global View
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded text-primary font-mono text-sm font-bold">
                        <ArrowUpRight className="w-4 h-4" /> Export Telemetry
                    </button>
                </div>
            </div>

            {/* Toolbar Area */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="SEARCH NODES BY ID OR LOCATION..."
                        className="w-full bg-slate-900/50 border border-white/10 rounded px-10 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-900/50 border border-white/10 rounded px-2">
                    <Filter className="w-4 h-4 text-slate-500 mx-1" />
                    {['ALL', 'ONLINE', 'OFFLINE'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${filter === f ? 'bg-primary text-black' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Node Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCameras.map((cam) => (
                    <div
                        key={cam.id}
                        className="group relative bg-[#0D1117] border border-white/5 rounded-xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-[0_0_20px_rgba(0,240,255,0.05)] flex flex-col"
                    >
                        {/* Status Bar */}
                        <div className={`h-1 w-full ${cam.status === 'ONLINE' ? 'bg-primary' : 'bg-red-500'}`}></div>

                        <div className="p-5 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-slate-950 rounded border border-white/5">
                                    <Shield className={`w-5 h-5 ${cam.status === 'ONLINE' ? 'text-primary' : 'text-red-400'}`} />
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${cam.status === 'ONLINE' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                    {cam.status}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors uppercase truncate">
                                {cam.name}
                            </h3>
                            <div className="text-[10px] text-slate-500 font-mono mb-4 flex items-center gap-2">
                                <Activity className="w-3 h-3 text-primary/60" /> NODE ID: {cam.id.slice(0, 12)}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-white/5">
                                <div>
                                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Stability</div>
                                    <div className="text-sm font-bold text-slate-200">{cam.uptimePercentage || 99.8}%</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Latency</div>
                                    <div className="text-sm font-bold text-primary">{cam.avgLatency || 124}ms</div>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(`/cameras/${cam.id}`)}
                                disabled={cam.status !== 'ONLINE'}
                                className={`w-full py-2.5 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${cam.status === 'ONLINE'
                                        ? 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-black shadow-lg shadow-black/20'
                                        : 'bg-slate-900 border border-white/5 text-slate-600 cursor-not-allowed'
                                    }`}
                            >
                                <Wifi className="w-3.5 h-3.5" /> {cam.status === 'ONLINE' ? 'Open Live HUD' : 'Node Offline'}
                            </button>
                        </div>
                    </div>
                ))}

                {/* Placeholder Add Node */}
                <div className="group border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center py-10 px-6 opacity-30 hover:opacity-100 transition-opacity cursor-pointer hover:border-primary/20 bg-white/[0.01]">
                    <div className="p-3 bg-slate-900 rounded-full border border-white/10 mb-3">
                        <Settings className="w-6 h-6 text-slate-500 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connect New Node</div>
                </div>
            </div>
        </div>
    );
};
