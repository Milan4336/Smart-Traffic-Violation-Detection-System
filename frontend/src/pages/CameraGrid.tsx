import React, { useEffect, useState, useRef } from 'react';
import {
    LayoutGrid,
    Maximize2,
    Activity,
    Command,
    Layers,
    AlertCircle,
    Camera as CameraIcon
} from 'lucide-react';
import Hls from 'hls.js';

interface CameraStreamProps {
    id: string;
    name: string;
    status: string;
}

const CameraStream: React.FC<CameraStreamProps> = ({ id, name, status }) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const backendBaseUrl = apiUrl.replace('/api', '');
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamError, setStreamError] = useState(false);

    useEffect(() => {
        if (status !== 'ONLINE') return;

        const startStream = async () => {
            try {
                await fetch(`${apiUrl}/live/${id}/start`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                setIsStreaming(true);
            } catch (err) {
                console.error("Failed to start stream", err);
                setStreamError(true);
            }
        };

        startStream();

        return () => {
            fetch(`${apiUrl}/live/${id}/stop`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            }).catch(e => console.error(e));
        };
    }, [id, status]);

    useEffect(() => {
        if (isStreaming && videoRef.current) {
            const hlsUrl = `${backendBaseUrl}/uploads/live/${id}/index.m3u8`;
            const video = videoRef.current;

            if (Hls.isSupported()) {
                const hls = new Hls({
                    lowLatencyMode: true,
                    backBufferLength: 30,
                    maxBufferLength: 3,
                });
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(e => console.error("Auto-play failed", e));
                });
                hls.on(Hls.Events.ERROR, () => setStreamError(true));
                return () => hls.destroy();
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = hlsUrl;
            }
        }
    }, [backendBaseUrl, isStreaming, id]);

    return (
        <div className="relative aspect-video bg-black border border-white/5 group overflow-hidden rounded-lg">
            {status !== 'ONLINE' || streamError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D1117]">
                    <AlertCircle className="w-8 h-8 text-slate-700 mb-2" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-4 text-center">
                        {status !== 'ONLINE' ? 'Node Offline' : 'Stream Failed'}
                    </span>
                </div>
            ) : (
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            )}

            <div className="absolute top-2 left-2 flex items-center gap-2">
                <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${status === 'ONLINE' ? 'bg-primary/80 text-black animate-pulse' : 'bg-red-500/80 text-white'
                    }`}>
                    {status === 'ONLINE' ? 'Live' : 'Off'}
                </div>
                <div className="px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-[8px] font-bold uppercase tracking-widest rounded border border-white/10">
                    {name}
                </div>
            </div>

            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 bg-background-dark/80 border border-white/20 rounded hover:bg-primary hover:text-black transition-colors">
                    <Maximize2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};

export const CameraGrid: React.FC = () => {
    const [allCameras, setAllCameras] = useState<any[]>([]);
    const [assignedCameras, setAssignedCameras] = useState<{ [key: number]: any }>({});
    const [layout, setLayout] = useState<number>(4); // 4 for 2x2, 9 for 3x3
    const [selectingSlot, setSelectingSlot] = useState<number | null>(null);

    useEffect(() => {
        const fetchCameras = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const res = await fetch(`${apiUrl}/cameras`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAllCameras(data);

                    // Auto-assign first N cameras to slots
                    const initial: any = {};
                    data.slice(0, layout).forEach((cam: any, idx: number) => {
                        initial[idx] = cam;
                    });
                    setAssignedCameras(initial);
                }
            } catch (err) {
                console.error("Failed to fetch cameras", err);
            }
        };
        fetchCameras();
    }, []);

    const assignCamera = (slotIdx: number, camera: any) => {
        setAssignedCameras(prev => ({ ...prev, [slotIdx]: camera }));
        setSelectingSlot(null);
    };

    const snapAll = async () => {
        const activeIds = Object.values(assignedCameras).map(c => c.id);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

        console.log(`Taking snapshots for ${activeIds.length} nodes...`);

        const promises = activeIds.map(id => fetch(`${apiUrl}/live/${id}/snapshot`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }));

        try {
            await Promise.all(promises);
            alert(`SQUAD SNAPSHOT: ${activeIds.length} frames secured.`);
        } catch (err) {
            console.error("Global snapshot failure", err);
        }
    };

    return (
        <div className="h-full flex flex-col bg-background-dark overflow-hidden font-mono relative">
            {/* Command Bar */}
            <div className="flex items-center justify-between p-4 border-b border-primary/20 bg-[#0A0D12] z-10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 border border-primary/20 rounded">
                        <Command className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white uppercase tracking-tighter">Tactical Stream Grid</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Multi-node synchronized monitoring surface</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* GLOBAL CONTROLS */}
                    <div className="flex items-center gap-2 border-r border-white/10 pr-4 mr-2">
                        <button
                            onClick={snapAll}
                            className="p-2 bg-white/[0.05] border border-white/10 rounded text-slate-300 hover:bg-primary/20 hover:text-primary transition-all flex items-center gap-2 text-[10px] font-bold uppercase"
                            title="Global Snapshot"
                        >
                            <CameraIcon className="w-3.5 h-3.5" /> SNAP ALL
                        </button>
                        <button
                            onClick={() => alert("SQUAD SILENCE: All tactical audio minimized.")}
                            className="p-2 bg-white/[0.05] border border-white/10 rounded text-slate-300 hover:bg-primary/20 hover:text-primary transition-all flex items-center gap-2 text-[10px] font-bold uppercase"
                            title="Mute All"
                        >
                            <Activity className="w-3.5 h-3.5 text-slate-500" /> SILENCE
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/5 rounded p-1 mr-4">
                        {[4, 9, 16].map((l) => (
                            <button
                                key={l}
                                onClick={() => setLayout(l)}
                                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${layout === l ? 'bg-primary text-black' : 'text-slate-500 hover:text-white'}`}
                            >
                                {Math.sqrt(l)}x{Math.sqrt(l)}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 px-4 py-2 bg-white/[0.02] border border-white/5 rounded text-[10px] text-slate-400">
                        <div className="flex items-center gap-2">
                            <Activity className="w-3 h-3 text-primary" /> {allCameras.filter(c => c.status === 'ONLINE').length} Active Nodes
                        </div>
                    </div>
                    <button className="p-2 bg-primary text-black rounded hover:shadow-neon hover:scale-105 transition-all">
                        <Layers className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Grid Content */}
            <div className={`flex-1 p-4 grid gap-4 bg-background-dark/50 overflow-y-auto ${layout === 4 ? 'grid-cols-2' : layout === 9 ? 'grid-cols-3' : 'grid-cols-4'
                }`}>
                {Array.from({ length: layout }).map((_, i) => {
                    const cam = assignedCameras[i];
                    if (cam) {
                        return (
                            <div key={`slot-${i}`} className="relative group">
                                <CameraStream id={cam.id} name={cam.name} status={cam.status} />
                                <button
                                    onClick={() => setSelectingSlot(i)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded border border-white/20 hover:bg-primary hover:text-black"
                                >
                                    <Layers className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    }
                    return (
                        <div
                            key={`empty-${i}`}
                            onClick={() => setSelectingSlot(i)}
                            className="aspect-video bg-black/20 border border-dashed border-white/5 rounded-lg flex flex-col items-center justify-center group hover:border-primary/20 transition-colors cursor-pointer"
                        >
                            <LayoutGrid className="w-8 h-8 text-slate-800 group-hover:text-primary/30" />
                            <span className="text-[9px] text-slate-600 mt-2 uppercase tracking-widest">Assign Camera Node</span>
                        </div>
                    );
                })}
            </div>

            {/* Selection Modal */}
            {selectingSlot !== null && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-10">
                    <div className="bg-[#0D1117] border border-primary/30 w-full max-w-2xl rounded-xl shadow-[0_0_100px_rgba(0,240,255,0.1)] flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Assign Node to Slot #{selectingSlot + 1}</h3>
                            <button onClick={() => setSelectingSlot(null)} className="text-slate-500 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
                            {allCameras.map((cam) => (
                                <button
                                    key={cam.id}
                                    onClick={() => assignCamera(selectingSlot, cam)}
                                    className="flex flex-col p-4 bg-white/[0.02] border border-white/10 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`size-2 rounded-full ${cam.status === 'ONLINE' ? 'bg-primary shadow-neon' : 'bg-red-500'}`}></span>
                                        <span className="text-[9px] text-slate-500 font-mono">{cam.id.slice(0, 8)}</span>
                                    </div>
                                    <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">{cam.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase mt-1">{cam.locationName || 'Unspecified Sector'}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Matrix Frame */}
            <div className="absolute inset-0 pointer-events-none border-[20px] border-background-dark shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] z-0"></div>
        </div>
    );
};
