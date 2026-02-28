import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ShieldAlert, ChevronLeft, Play, Pause } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const VideoDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [video, setVideo] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [playing, setPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const navigate = useNavigate();

    const fetchVideoDetails = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiUrl}/videos/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setVideo(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch video details", err);
        }
    };

    useEffect(() => {
        fetchVideoDetails();
    }, [id]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (playing) videoRef.current.pause();
            else videoRef.current.play();
            setPlaying(!playing);
        }
    };

    const jumpToTime = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.play();
            setPlaying(true);
        }
    };

    if (!video) return (
        <div className="h-full flex items-center justify-center font-mono text-primary animate-pulse uppercase tracking-[0.3em] bg-background-dark/50">
            INITIALIZING SECURE VIDEO DECODER...
        </div>
    );

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/videos')}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-display font-bold text-white uppercase tracking-widest">
                            {video.filePath.split('/').pop()}
                        </h1>
                        <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2 uppercase">
                            <Clock className="w-3 h-3" /> PROCESSED ON {new Date(video.processedAt || video.uploadedAt).toLocaleString()}
                        </p>
                    </div>
                </div>
                <Badge variant="success" pulse>SCAN COMPLETE</Badge>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                {/* Video Player Column */}
                <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                    <div className="relative aspect-video rounded-xl border border-primary/20 bg-black overflow-hidden group shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-contain cursor-pointer"
                            src={`${backendUrl}${video.filePath}`}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={() => setPlaying(false)}
                            onClick={togglePlay}
                        />

                        {/* Custom Controls Overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                                    {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                                </button>
                                <div className="flex-1 h-2 bg-slate-800/80 rounded-full relative">
                                    <div
                                        className="h-full bg-primary shadow-[0_0_10px_#00F0FF] rounded-full transition-all duration-100"
                                        style={{ width: `${(currentTime / (video.durationSeconds || 1)) * 100}%` }}
                                    ></div>
                                    {/* Timeline Markers */}
                                    {video.violations.map((v: any, i: number) => (
                                        <div
                                            key={i}
                                            className="absolute top-0 w-1.5 h-full bg-alert shadow-[0_0_5px_#FF0055] cursor-pointer hover:scale-x-150 transition-transform"
                                            style={{ left: `${(v.frameTimestamp / (video.durationSeconds || 1)) * 100}%` }}
                                            onClick={(e) => { e.stopPropagation(); jumpToTime(v.frameTimestamp); }}
                                            title={`${v.violationType} Detected`}
                                        ></div>
                                    ))}
                                </div>
                                <span className="text-[10px] font-mono text-white min-w-[70px] text-right">
                                    {Math.floor(currentTime)}s / {Math.round(video.durationSeconds || 0)}s
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-4 rounded-lg border border-slate-800 flex items-center gap-8 justify-around shrink-0 font-mono shadow-inner">
                        <div className="text-center text-xs">
                            <div className="text-slate-500 mb-1 tracking-widest text-[9px] uppercase">TOTAL INCIDENTS</div>
                            <div className="text-xl font-bold text-white">{video.violations.length}</div>
                        </div>
                        <div className="text-center text-xs">
                            <div className="text-slate-500 mb-1 tracking-widest text-[9px] uppercase">FPS CAPTURE</div>
                            <div className="text-xl font-bold text-primary">30.0</div>
                        </div>
                        <div className="text-center text-xs">
                            <div className="text-slate-500 mb-1 tracking-widest text-[9px] uppercase">MEAN ACCURACY</div>
                            <div className="text-xl font-bold text-success">
                                {video.violations.length > 0 ? Math.round(video.violations.reduce((acc: any, curr: any) => acc + curr.confidenceScore, 0) / video.violations.length) : '0'}%
                            </div>
                        </div>
                        <div className="text-center text-xs">
                            <div className="text-slate-500 mb-1 tracking-widest text-[9px] uppercase">AI SCAN SPEED</div>
                            <div className="text-xl font-bold text-slate-300">
                                4.2x
                            </div>
                        </div>
                    </div>
                </div>

                {/* Violations List Column */}
                <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
                    <h3 className="text-xs font-bold text-primary tracking-widest uppercase flex items-center justify-between shrink-0">
                        TIMELINE EVENTS
                        <span className="text-[10px] text-slate-500 font-normal">REAL-TIME SYNC</span>
                    </h3>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar scroll-smooth">
                        {video.violations.map((v: any, i: number) => (
                            <div
                                key={i}
                                className={`glass-panel p-3 rounded border border-slate-800 hover:border-alert/30 transition-all cursor-pointer group ${Math.abs(currentTime - v.frameTimestamp) < 1.5 ? 'border-alert/50 bg-alert/5 shadow-[0_0_15px_rgba(255,0,85,0.15)] ring-1 ring-alert/20' : ''
                                    }`}
                                onClick={() => jumpToTime(v.frameTimestamp)}
                            >
                                <div className="flex gap-4">
                                    <div className="w-24 aspect-video rounded-sm border border-slate-800 overflow-hidden bg-black relative shrink-0">
                                        <img
                                            src={`${backendUrl}${v.evidenceImagePath}`}
                                            alt="Evidence"
                                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-all">
                                            <Play className="w-4 h-4 text-white fill-current" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold font-mono text-alert uppercase tracking-tight truncate pr-2">
                                                {v.violationType}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">T+{Math.round(v.frameTimestamp)}s</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-white font-mono tracking-widest">{v.plateNumber || 'N/A'}</span>
                                            <span className="text-[10px] font-medium text-success whitespace-nowrap">{Math.round(v.confidenceScore)}% ACC</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {video.violations.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 grayscale opacity-50 select-none pb-12">
                                <ShieldAlert size={48} className="text-slate-700" />
                                <span className="font-mono text-[10px] uppercase tracking-[0.2em]">NO ANOMALIES DETECTED</span>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-lg shrink-0 mt-auto">
                        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500 mb-3 uppercase tracking-widest">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </span>
                            AI ENGINE CLEARANCE: MASTER
                        </div>
                        <Button className="w-full py-2.5 bg-slate-800 text-slate-300 text-[10px] font-bold tracking-[0.2em] border border-slate-700 hover:border-primary/50 hover:text-primary transition-all uppercase rounded font-display shadow-sm">
                            GENERATE SECURE REPORT
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
