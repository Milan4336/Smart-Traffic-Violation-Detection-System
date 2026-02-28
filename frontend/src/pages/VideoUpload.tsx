import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Video, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { socket } from '../socket';

export const VideoUpload: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [videos, setVideos] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchVideos = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiUrl}/videos`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setVideos(data);
            }
        } catch (err) {
            console.error("Failed to fetch videos", err);
        }
    };

    useEffect(() => {
        fetchVideos();

        const handleStatusUpdate = (data: any) => {
            setVideos(prev => prev.map(v => v.id === data.videoId ? { ...v, status: data.status } : v));
        };

        socket.on('video:status', handleStatusUpdate);
        return () => {
            socket.off('video:status', handleStatusUpdate);
        };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('video', file);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiUrl}/videos/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            if (res.ok) {
                const newVideo = await res.json();
                setVideos(prev => [newVideo, ...prev]);
                setFile(null);
            } else {
                const data = await res.json();
                setError(data.error || 'Upload failed');
            }
        } catch (err) {
            setError('System connection error during upload');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col gap-8 overflow-y-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-display font-bold text-white tracking-widest uppercase flex items-center gap-3">
                    <Video className="text-primary w-6 h-6" /> VIDEO ANALYSIS PORTAL
                </h1>
                <p className="text-slate-400 font-mono text-sm">Upload traffic footage for automated AI violation detection.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Section */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="glass-panel p-6 rounded-xl border border-primary/20 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div className="size-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-2">
                            <Upload className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-display font-bold text-white uppercase tracking-wider">NEW SCAN UPLINK</h3>
                        <p className="text-slate-400 text-xs font-mono max-w-[200px]">Supports MP4, AVI, MOV. Max file size: 500MB.</p>

                        <input
                            type="file"
                            id="video-upload"
                            className="hidden"
                            accept="video/*"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                        <label
                            htmlFor="video-upload"
                            className="w-full py-3 bg-slate-800 border border-slate-700 rounded text-slate-300 font-bold tracking-widest hover:border-primary/50 transition-all cursor-pointer block"
                        >
                            {file ? file.name : 'CHOOSE FILE'}
                        </label>

                        {error && (
                            <div className="flex items-center gap-2 text-alert text-xs font-mono mt-2 animate-pulse uppercase">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <Button
                            className="w-full py-4 bg-primary text-background-dark font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all flex items-center justify-center gap-3"
                            disabled={!file || uploading}
                            onClick={handleUpload}
                        >
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                            {uploading ? 'PROCESSING...' : 'INITIALIZE SCAN'}
                        </Button>
                    </div>

                    <div className="glass-panel p-6 rounded-xl border border-slate-800 flex flex-col gap-4">
                        <h4 className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Scanning Protocols</h4>
                        <div className="space-y-3">
                            {['YOLOv8-HEURISTIC ENGINE', 'RED LIGHT VIOLATION', 'SPEED THRESHOLDING', 'OCR PLATE EXTRACTION', 'LANE DISCIPLINE ANALYSIS'].map((protocol) => (
                                <div key={protocol} className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                                    <div className="w-2 h-2 bg-success rounded-full animate-pulse shadow-[0_0_5px_#05FFA1]"></div>
                                    <span>{protocol}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Queue/History Section */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <h3 className="text-sm font-mono font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                        SCAN HISTORY & QUEUE
                        <span className="text-[10px] text-primary">{videos.length} TOTAL SESSIONS</span>
                    </h3>

                    <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {videos.map((video) => (
                            <div
                                key={video.id}
                                className="glass-panel p-4 rounded-lg border border-slate-800 hover:border-primary/30 transition-all group flex items-center justify-between cursor-pointer"
                                onClick={() => video.status === 'completed' && navigate(`/videos/${video.id}`)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="size-10 rounded bg-slate-900 border border-slate-700 flex items-center justify-center relative overflow-hidden">
                                        {video.status === 'processing' && (
                                            <div className="absolute inset-0 bg-primary/20 animate-pulse"></div>
                                        )}
                                        <Video className={`w-5 h-5 ${video.status === 'completed' ? 'text-success' : video.status === 'processing' ? 'text-primary' : 'text-slate-500'}`} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white font-mono tracking-tight underline-offset-4 decoration-primary group-hover:underline">
                                            {video.filePath.split('/').pop()}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-3 uppercase">
                                            <Clock className="w-3 h-3" /> {new Date(video.uploadedAt).toLocaleString()}
                                            {video.durationSeconds && (
                                                <span className="text-slate-400 font-bold">• {Math.round(video.durationSeconds)} SECONDS</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {video.status === 'completed' && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-slate-500 font-mono uppercase">VIOLATIONS</span>
                                            <span className="text-sm font-bold text-alert font-mono">{video._count?.violations || 0}</span>
                                        </div>
                                    )}

                                    <div className="w-32 flex justify-end">
                                        <Badge
                                            variant={
                                                video.status === 'completed' ? 'success' :
                                                    video.status === 'processing' ? 'primary' :
                                                        video.status === 'failed' ? 'alert' : 'default'
                                            }
                                            pulse={video.status === 'processing'}
                                        >
                                            {video.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {videos.length === 0 && (
                            <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                <Video className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                <p className="text-slate-500 font-mono">NO ANALYSIS SESSIONS FOUND. INITIALIZE AN UPLINK TO START.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
