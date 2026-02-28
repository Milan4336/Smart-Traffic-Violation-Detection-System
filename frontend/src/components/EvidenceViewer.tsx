import React, { useEffect, useState, useRef } from 'react';
import { X, Play, Pause, SkipForward, SkipBack, Image as ImageIcon, Video, Target, Info, MapPin, Calendar, Clock, DollarSign, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';
import { Button } from './ui/Button';

interface EvidenceViewerProps {
    violationId: string;
    onClose: () => void;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ violationId, onClose }) => {
    const [evidence, setEvidence] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [viewMode, setViewMode] = useState<'image' | 'video'>('image');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const baseUrl = apiUrl.replace('/api', '');

    useEffect(() => {
        const fetchEvidence = async () => {
            try {
                const res = await axios.get(`${apiUrl}/violations/${violationId}/evidence`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEvidence(res.data);
                setCurrentTime(res.data.timestampSeconds || 0);
            } catch (err) {
                console.error("Failed to fetch evidence", err);
            } finally {
                setLoading(false);
            }
        };
        fetchEvidence();
    }, [violationId]);

    // Draw bounding box on image
    useEffect(() => {
        if (evidence?.boundingBox && canvasRef.current && viewMode === 'image') {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = `${baseUrl}${evidence.imageUrl}`;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);

                if (ctx) {
                    const [x1, y1, x2, y2] = evidence.boundingBox;
                    ctx.strokeStyle = '#FF2A6D';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

                    // Add label
                    ctx.fillStyle = '#FF2A6D';
                    ctx.font = 'bold 24px monospace';
                    ctx.fillText(evidence.metadata.type, x1, y1 - 10);
                }
            };
        }
    }, [evidence, viewMode]);

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleJumpToViolation = () => {
        if (videoRef.current && evidence?.timestampSeconds) {
            videoRef.current.currentTime = evidence.timestampSeconds;
        }
    };

    const handleFrameStep = (direction: 'forward' | 'backward') => {
        if (videoRef.current) {
            const fps = 30; // Assuming 30 FPS if not available
            const step = 1 / fps;
            videoRef.current.currentTime += direction === 'forward' ? step : -step;
        }
    };

    if (loading) return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="text-primary animate-pulse font-mono uppercase tracking-widest">Initialising Forensic Matrix...</div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8">
            <div className="glass-panel w-full max-w-6xl h-full max-h-[90vh] flex flex-col rounded-xl border border-white/10 relative overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded bg-alert/20 flex items-center justify-center border border-alert/30 text-alert shadow-neon-alert">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Violation Auditor <span className="text-alert font-mono not-italic text-sm ml-2">[{violationId.slice(0, 8)}]</span></h2>
                            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">High-Prescision Forensic Evidence Review HUD</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                    {/* Left: Metadata Panel */}
                    <aside className="w-full md:w-72 border-r border-white/10 p-6 flex flex-col gap-6 bg-black/40 overflow-y-auto">
                        <section>
                            <h3 className="text-[10px] font-display font-bold text-primary mb-4 tracking-[0.2em] uppercase border-b border-primary/20 pb-1">Primary Intel</h3>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-mono uppercase">Vehicle Plate</label>
                                    <div className="text-lg font-mono font-bold text-white bg-white/5 px-2 py-1 rounded border border-white/10">{evidence.metadata.plateNumber}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-mono uppercase">Violation Type</label>
                                    <div className="text-sm font-display font-bold text-alert uppercase tracking-tight">{evidence.metadata.type.replace('_', ' ')}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-mono uppercase">Confidence Vector</label>
                                    <div className="text-sm font-mono font-bold text-success">{evidence.metadata.confidence.toFixed(2)}%</div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-[10px] font-display font-bold text-primary mb-4 tracking-[0.2em] uppercase border-b border-primary/20 pb-1">Geospatial / Temporal</h3>
                            <div className="space-y-3 font-mono text-[10px]">
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Camera size={12} className="text-primary" />
                                    <span>{evidence.metadata.cameraName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <MapPin size={12} className="text-primary" />
                                    <span>{evidence.metadata.location.lat?.toFixed(4)}, {evidence.metadata.location.lng?.toFixed(4)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Calendar size={12} className="text-primary" />
                                    <span>{new Date(evidence.metadata.time).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Clock size={12} className="text-primary" />
                                    <span>{new Date(evidence.metadata.time).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </section>

                        <section className="mt-auto">
                            <div className="bg-alert/10 border border-alert/30 p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-alert mb-2">
                                    <DollarSign size={16} />
                                    <span className="font-display font-bold text-sm">ENFORCEMENT FINE</span>
                                </div>
                                <div className="text-2xl font-mono font-black text-white">₹{evidence.metadata.fineAmount?.toLocaleString() || '0'}</div>
                            </div>
                        </section>
                    </aside>

                    {/* Right: Media Explorer */}
                    <main className="flex-1 flex flex-col bg-slate-900/50 p-6 relative overflow-hidden">
                        {/* Mode Switcher */}
                        <div className="absolute top-10 right-10 z-10 flex gap-2">
                            <Button
                                variant={viewMode === 'image' ? 'primary' : 'outline'}
                                size="sm"
                                className="text-[10px] font-bold"
                                onClick={() => setViewMode('image')}
                            >
                                <ImageIcon size={14} className="mr-1" /> STILL FRAME
                            </Button>
                            <Button
                                variant={viewMode === 'video' ? 'primary' : 'outline'}
                                size="sm"
                                className="text-[10px] font-bold"
                                onClick={() => setViewMode('video')}
                                disabled={!evidence.videoUrl}
                            >
                                <Video size={14} className="mr-1" /> VIDEO EVIDENCE
                            </Button>
                        </div>

                        {/* Viewport */}
                        <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-black border border-white/5 shadow-2xl">
                            {viewMode === 'image' ? (
                                <canvas
                                    ref={canvasRef}
                                    className="max-w-full max-h-full object-contain cursor-crosshair"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center relative">
                                    <video
                                        ref={videoRef}
                                        src={`${baseUrl}${evidence.videoUrl}`}
                                        className="max-w-full max-h-full"
                                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                                        onEnded={() => setIsPlaying(false)}
                                    />
                                    {/* Video HUD Overlay */}
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded text-[10px] font-mono text-white flex items-center gap-2">
                                        <div className="size-2 rounded-full bg-alert animate-pulse"></div>
                                        <span>FRAME_CAPTURE: {currentTime.toFixed(3)}s</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Controls HUD */}
                        <div className="mt-6 flex flex-col gap-4">
                            {viewMode === 'video' && (
                                <div className="flex flex-col gap-2">
                                    {/* Timeline Slider */}
                                    <div className="relative h-6 group">
                                        <input
                                            type="range"
                                            min={0}
                                            max={duration}
                                            step={0.01}
                                            value={currentTime}
                                            onChange={(e) => {
                                                if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
                                            }}
                                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary hover:h-2 transition-all mt-2"
                                        />
                                        {/* Violation Marker */}
                                        {evidence.timestampSeconds && (
                                            <div
                                                className="absolute top-0 w-0.5 h-6 bg-alert shadow-neon-alert z-10 pointer-events-none"
                                                style={{ left: `${(evidence.timestampSeconds / duration) * 100}%` }}
                                            >
                                                <div className="absolute -top-1 -left-1.5 p-1 bg-alert text-white rounded-full">
                                                    <ShieldAlert size={6} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* HUD Buttons */}
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="icon" onClick={() => handleFrameStep('backward')} className="bg-white/5 hover:bg-white/10">
                                                <SkipBack size={16} />
                                            </Button>
                                            <Button variant="primary" size="icon" onClick={handlePlayPause} className="size-12 rounded-full">
                                                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => handleFrameStep('forward')} className="bg-white/5 hover:bg-white/10">
                                                <SkipForward size={16} />
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-xs text-slate-400">
                                                {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(2).padStart(5, '0')} / {Math.floor(duration / 60)}:{(duration % 60).toFixed(2).padStart(5, '0')}
                                            </span>
                                            <Button
                                                variant="alert"
                                                size="sm"
                                                className="text-[10px] font-bold shadow-neon-alert"
                                                onClick={handleJumpToViolation}
                                            >
                                                <Target size={14} className="mr-1" /> JUMP TO INCIDENT
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {viewMode === 'image' && (
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                                        <Info size={14} className="text-primary" />
                                        <span>Bounding box rendered from AI detection matrix. Target tracking coordinates: [{evidence.boundingBox?.join(', ')}]</span>
                                    </div>
                                    <Button variant="primary" size="sm" className="text-[10px] font-bold" onClick={() => window.open(`${baseUrl}${evidence.imageUrl}`, '_blank')}>
                                        DOWNLOAD FRAME
                                    </Button>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};
