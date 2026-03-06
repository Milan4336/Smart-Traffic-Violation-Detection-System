import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Hls from 'hls.js';
import {
    ChevronLeft,
    Activity,
    Shield,
    Camera as CameraIcon,
    AlertTriangle,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { socket } from '../socket';

export const CameraViewer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const backendBaseUrl = apiUrl.replace('/api', '');
    const videoRef = useRef<HTMLVideoElement>(null);
    const [camera, setCamera] = useState<any>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [liveViolations, setLiveViolations] = useState<any[]>([]);
    const [lastViolation, setLastViolation] = useState<any>(null);
    const [showOverlay, setShowOverlay] = useState(false);
    const [snapshotStatus, setSnapshotStatus] = useState<'idle' | 'capturing' | 'success' | 'error'>('idle');
    const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchCamera = async () => {
            try {
                const res = await fetch(`${apiUrl}/cameras/${id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCamera(data);
                }
            } catch (err) {
                console.error("Failed to fetch camera", err);
            }
        };

        fetchCamera();

        // Start Streaming on AI Service
        const startStream = async () => {
            try {
                await fetch(`${apiUrl}/live/${id}/start`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                setIsStreaming(true);
            } catch (err) {
                console.error("Failed to start stream", err);
                setError("AI service unavailable");
            }
        };

        startStream();

        // Listen for live violations on this camera
        const handleViolation = (violation: any) => {
            if (violation.cameraId === id) {
                setLiveViolations(prev => [violation, ...prev].slice(0, 5));
                setLastViolation(violation);
                setShowOverlay(true);
                // Hide overlay after 5 seconds
                setTimeout(() => setShowOverlay(false), 5000);
            }
        };

        socket.on('violation:new', handleViolation);

        return () => {
            // Stop Streaming on AI Service
            const stopStream = async () => {
                fetch(`${apiUrl}/live/${id}/stop`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                }).catch(e => console.error(e));
            };
            stopStream();
            socket.off('violation:new', handleViolation);
        };
    }, [id]);

    useEffect(() => {
        if (isStreaming && videoRef.current) {
            const hlsUrl = `${backendBaseUrl}/uploads/live/${id}/index.m3u8`;
            const video = videoRef.current;

            if (Hls.isSupported()) {
                const hls = new Hls({
                    lowLatencyMode: true,
                    backBufferLength: 60,
                });
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(e => console.error("Auto-play failed", e));
                });

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.log("HLS Network error, retrying...");
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log("HLS Media error, fatal, recovering...");
                                hls.recoverMediaError();
                                break;
                            default:
                                hls.destroy();
                                break;
                        }
                    }
                });

                return () => hls.destroy();
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS for Safari
                video.src = hlsUrl;
            }
        }
    }, [backendBaseUrl, isStreaming, id]);

    const takeSnapshot = async () => {
        setSnapshotStatus('capturing');
        try {
            const res = await fetch(`${apiUrl}/live/${id}/snapshot`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSnapshotUrl(`${backendBaseUrl}${data.snapshotUrl}`);
                setSnapshotStatus('success');
                setTimeout(() => setSnapshotStatus('idle'), 3000);
            } else {
                setSnapshotStatus('error');
            }
        } catch (err) {
            console.error("Snapshot error", err);
            setSnapshotStatus('error');
        }
    };

    if (!camera) return <div className="p-10 text-white font-mono animate-pulse">CONNECTING TO NODE...</div>;

    const statusColors: any = {
        HEALTHY: 'bg-primary shadow-neon',
        DEGRADED: 'bg-yellow-500 shadow-neon-alert',
        OFFLINE: 'bg-red-500 shadow-red-500/50'
    };

    return (
        <div className="flex flex-col h-full bg-background-dark text-slate-200 overflow-hidden font-mono">
            {/* Header HUD */}
            <div className="flex items-center justify-between p-4 border-b border-primary/20 bg-background-dark/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Link to="/live-monitoring" className="p-2 hover:bg-slate-800 rounded-full transition-colors text-primary">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold uppercase tracking-tighter text-white">{camera.name}</h2>
                            <span className={`size-2 rounded-full ${statusColors[camera.nodeHealth || camera.healthStatus] || 'bg-slate-500'}`}></span>
                            <span className="text-[10px] text-primary/70 font-bold uppercase">{camera.id}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> LIVE FEED SECURED &bull; BGR24 ENCODED
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-slate-500 uppercase">Latency</div>
                        <div className="text-sm font-bold text-primary">{camera.avgLatency || camera.latencyMs || 0} MS</div>
                    </div>
                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-slate-500 uppercase">Stability</div>
                        <div className="text-sm font-bold text-primary">{camera.uptimePercentage || 100}%</div>
                    </div>
                    <button
                        onClick={takeSnapshot}
                        disabled={snapshotStatus === 'capturing' || !isStreaming}
                        className={`flex items-center gap-2 px-4 py-2 rounded transition-all text-sm font-bold uppercase tracking-widest ${snapshotStatus === 'success'
                                ? 'bg-green-500 text-black'
                                : snapshotStatus === 'error'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
                            }`}
                    >
                        <CameraIcon className={`w-4 h-4 ${snapshotStatus === 'capturing' ? 'animate-spin' : ''}`} />
                        {snapshotStatus === 'capturing' ? 'Capturing...' : snapshotStatus === 'success' ? 'Captured!' : 'Snapshot'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Main Video Viewport */}
                <div className="flex-1 relative bg-black flex items-center justify-center p-4">
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 group shadow-2xl">
                        {error ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 space-y-4">
                                <AlertTriangle className="w-16 h-16 animate-pulse" />
                                <div className="text-xl font-bold uppercase tracking-widest">{error}</div>
                                <button onClick={() => window.location.reload()} className="px-4 py-2 border border-red-500/50 rounded hover:bg-red-500/10 uppercase text-xs">Reconnect</button>
                            </div>
                        ) : (
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                            />
                        )}

                        {/* Video Overlays */}
                        <div className="absolute top-4 left-4 flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-600/90 text-white text-xs font-bold rounded shadow-lg animate-pulse">
                                <span className="size-1.5 rounded-full bg-white"></span> LIVE
                            </div>
                            <div className="px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] rounded uppercase font-bold tracking-widest">
                                {camera.fps || camera.currentFps || 0} FPS &bull; {camera.avgLatency || camera.latencyMs || 0}ms
                            </div>
                        </div>

                        {/* Scanner Frame corner markers */}
                        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-primary/50"></div>
                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary/50"></div>
                        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary/50"></div>
                        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-primary/50"></div>

                        {/* Matrix Grid Surface Overlay */}
                        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(0,240,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

                        {/* VIOLATION OVERLAY */}
                        {showOverlay && lastViolation && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                <div className="bg-red-600/90 backdrop-blur-xl border-2 border-white/50 text-white px-8 py-6 rounded-2xl shadow-[0_0_50px_rgba(255,0,0,0.5)] flex flex-col items-center animate-bounce">
                                    <AlertTriangle className="w-16 h-16 mb-4 text-white" />
                                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-1">Violation Detected</h3>
                                    <div className="text-xl font-mono border-y border-white/30 py-2 w-full text-center mb-2">
                                        {lastViolation.type}
                                    </div>
                                    <div className="text-sm font-bold opacity-80 uppercase tracking-widest">
                                        Plate: {lastViolation.plateNumber}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Snapshot Preview Notification */}
                        {snapshotUrl && snapshotStatus === 'success' && (
                            <div className="absolute bottom-6 left-6 z-30 animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-black/80 backdrop-blur-md border border-primary/30 p-2 rounded-lg shadow-2xl flex items-center gap-4">
                                    <div className="w-24 aspect-video rounded overflow-hidden border border-white/10">
                                        <img src={snapshotUrl} alt="Snapshot" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="pr-4">
                                        <div className="text-[10px] text-primary font-bold uppercase">Snapshot Secured</div>
                                        <div className="text-[8px] text-slate-400 font-mono">/uploads/snapshots/...</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side Panel: Telemetry & Live Events */}
                <div className="w-80 bg-[#0A0D12] border-l border-white/5 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-3 h-3 text-primary" /> Node Telemetry
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Health Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                                <span className="text-[10px] text-slate-500 block uppercase mb-1">Status</span>
                                <div className="flex items-center gap-2">
                                    {camera.status === 'ONLINE' ? (
                                        <CheckCircle className="w-3 h-3 text-primary" />
                                    ) : (
                                        <XCircle className="w-3 h-3 text-red-500" />
                                    )}
                                    <span className="text-sm font-bold text-white">{camera.status}</span>
                                </div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                                <span className="text-[10px] text-slate-500 block uppercase mb-1">Health</span>
                                <div className="text-sm font-bold text-primary uppercase">{camera.nodeHealth || camera.healthStatus}</div>
                            </div>
                        </div>

                        {/* Violation Timeline */}
                        <div>
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                                Live Ingress Events
                                <span className="text-[9px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">REALTIME</span>
                            </h4>
                            <div className="space-y-3">
                                {liveViolations.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Activity className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-pulse" />
                                        <p className="text-[10px] text-slate-600 uppercase">Monitoring traffic patterns...</p>
                                    </div>
                                ) : (
                                    liveViolations.map((v, i) => (
                                        <div key={i} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg hover:border-primary/30 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold text-primary uppercase">{v.type}</span>
                                                <span className="text-[9px] text-slate-600">{new Date(v.createdAt).toLocaleTimeString([], { hour12: false })}</span>
                                            </div>
                                            <div className="text-sm font-bold text-white mb-1">{v.plateNumber}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-slate-500 uppercase">Confidence</span>
                                                <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: `${v.confidenceScore}%` }}></div>
                                                </div>
                                                <span className="text-[9px] text-primary">{v.confidenceScore}%</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Threat Shield */}
                    <div className="p-4 bg-primary/5 border-t border-primary/20">
                        <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-5 h-5 text-primary" />
                            <div>
                                <div className="text-xs font-bold text-white uppercase tracking-tighter">Neon Guardian v1.5</div>
                                <div className="text-[9px] text-primary font-bold uppercase">Enforcement AI Active</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
