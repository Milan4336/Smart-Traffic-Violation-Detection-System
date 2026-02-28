import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { ViolationCard } from '../components/cards/ViolationCard';
import { ShieldAlert, Cpu, Video, Activity, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { socket } from '../socket';
import { LiveMap } from '../components/LiveMap';

export const AnalyticsCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: { value: string; positive: boolean };
    color: 'primary' | 'success' | 'alert' | 'warning';
}> = ({ title, value, subtitle, icon, trend, color }) => {
    const colorMap = {
        primary: 'bg-primary shadow-[0_0_10px_#00F0FF] border-[#00F0FF]/15',
        success: 'bg-success shadow-[0_0_10px_#05FFA1] border-[#05FFA1]/15',
        alert: 'bg-alert shadow-[0_0_10px_#FF2A6D] border-[#FF2A6D]/15',
        warning: 'bg-warning shadow-[0_0_10px_#ffeb3b] border-[#ffeb3b]/15',
    };

    const textMap = {
        primary: 'text-primary',
        success: 'text-success',
        alert: 'text-alert',
        warning: 'text-warning',
    };

    return (
        <div className={twMerge(
            "glass-panel p-5 rounded-lg relative overflow-hidden group hover:bg-[#0f172a]/80 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-neon",
            colorMap[color].split(' ')[2] // border color
        )}>
            <div className={clsx("absolute bottom-0 left-0 w-full h-[2px]", colorMap[color])}></div>
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-xs font-display uppercase tracking-wider">{title}</span>
                <span className={clsx(textMap[color], "opacity-50")}>{icon}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-mono font-bold text-white">{value}</span>
                {trend && (
                    <span className={clsx("text-xs font-mono", trend.positive ? "text-success" : "text-alert")}>
                        {trend.positive ? '▲' : '▼'} {trend.value}
                    </span>
                )}
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                <div className={clsx("h-full w-[80%]", colorMap[color])}></div>
            </div>
            {subtitle && <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase">{subtitle}</p>}
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const [analytics, setAnalytics] = useState({ totalViolations: 0, todayViolations: 0, activeCameras: 0, avgConfidence: 0 });
    const [cameraStatus, setCameraStatus] = useState({ online_cameras: 0, offline_cameras: 0, health: 'UNKNOWN' });
    const [cameras, setCameras] = useState<any[]>([]);
    const [recentViolations, setRecentViolations] = useState<any[]>([]);
    const [liveAlerts, setLiveAlerts] = useState<any[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

            try {
                const [analyticsRes, camStatusRes, violationsRes, camerasRes] = await Promise.all([
                    fetch(`${apiUrl}/analytics`, { headers }),
                    fetch(`${apiUrl}/cameras/status`, { headers }),
                    fetch(`${apiUrl}/violations?limit=2`, { headers }), // 2 for recent verifications list
                    fetch(`${apiUrl}/cameras`, { headers }) // 2 for recent verifications list
                ]);

                if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
                if (camStatusRes.ok) setCameraStatus(await camStatusRes.json());
                if (camerasRes.ok) setCameras(await camerasRes.json());
                if (violationsRes.ok) {
                    const data = await violationsRes.json();
                    setRecentViolations(data.data || []);
                    setLiveAlerts(data.data || []); // prefill alerts
                }
            } catch (err) {
                console.error("Dashboard DB Sync Error", err);
            }
        };

        fetchDashboardData();

        // Socket Bindings
        socket.on('violation:new', (violation) => {
            setAnalytics(prev => ({
                ...prev,
                todayViolations: prev.todayViolations + 1,
                totalViolations: prev.totalViolations + 1
            }));

            setLiveAlerts(prev => [JSON.parse(violation), ...prev].slice(0, 10)); // Keep top 10
        });

        socket.on('camera:offline', (cam) => {
            console.log("Camera Offline Alert", cam);
            setCameraStatus(prev => ({
                ...prev,
                offline_cameras: prev.offline_cameras + 1,
                online_cameras: Math.max(0, prev.online_cameras - 1),
                health: 'CRITICAL'
            }));
        });

        return () => {
            socket.off('violation:new');
            socket.off('camera:offline');
        };
    }, []);

    return (
        <div className="h-full grid grid-cols-12 gap-6 p-6 overflow-hidden relative">
            {/* Left Column: Key Stats (3 Cols) */}
            <section className="col-span-3 flex flex-col gap-4 h-full overflow-y-auto pr-1 pb-4">
                <h2 className="font-display font-bold text-lg text-white/80 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="text-primary w-4 h-4" /> SYSTEM METRICS
                </h2>

                <AnalyticsCard
                    title="Violations Today"
                    value={analytics.todayViolations.toLocaleString()}
                    subtitle={`TOTAL LIFETIME: ${analytics.totalViolations.toLocaleString()}`}
                    icon={<ShieldAlert className="w-5 h-5" />}
                    color="alert"
                />

                <AnalyticsCard
                    title="AI Confidence"
                    value={`${analytics.avgConfidence.toFixed(1)}%`}
                    subtitle="AGGREGATE MATRIX AVERAGE"
                    icon={<Cpu className="w-5 h-5" />}
                    color={analytics.avgConfidence > 90 ? 'success' : 'warning'}
                />

                <AnalyticsCard
                    title="Active Nodes"
                    value={cameraStatus.online_cameras}
                    subtitle={`${cameraStatus.offline_cameras} NODES OFFLINE`}
                    icon={<Video className="w-5 h-5" />}
                    color={cameraStatus.health === 'CRITICAL' ? 'alert' : 'primary'}
                />

                <div className="mt-4 flex flex-col gap-2 flex-1 min-h-0">
                    <h3 className="text-slate-400 text-xs font-display uppercase tracking-wider mb-1">Recent Logs</h3>
                    <div className="flex flex-col gap-2 overflow-hidden">
                        {recentViolations.map((v, i) => (
                            <ViolationCard
                                key={i}
                                plate={v.plateNumber || 'UNKNOWN'}
                                type={v.type.toUpperCase()}
                                confidence={v.confidenceScore}
                                time={new Date(v.createdAt).toLocaleTimeString()}
                                cameraId={v.cameraId}
                                status={v.status}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Center Column: Live Map (6 Cols) */}
            <section className="col-span-6 flex flex-col h-full relative">
                <h2 className="font-display font-bold text-lg text-white/80 uppercase tracking-widest flex items-center gap-2 mb-4 relative z-10">
                    <Globe className="text-primary w-4 h-4" /> GEOSPATIAL MATRIX
                </h2>
                <div className="flex-1 rounded-lg relative overflow-hidden scanline-effect group border border-slate-700/50">
                    <LiveMap cameras={cameras} violations={liveAlerts} />
                </div>
            </section>

            {/* Right Column: Alert Ticker (3 Cols) */}
            <section className="col-span-3 flex flex-col h-full gap-4">
                <h2 className="font-display font-bold text-lg text-white/80 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="text-alert w-4 h-4" /> LIVE INTELLIGENCE
                </h2>
                <div className="flex-1 glass-panel rounded-lg overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <span className="text-xs font-mono text-slate-400">FEED STATUS</span>
                        <div className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-success animate-pulse"></span>
                            <span className="text-[10px] font-bold text-success tracking-wider">LIVE DATA</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 relative">
                        {liveAlerts.map((alert: any, idx: number) => (
                            <div key={idx} className="animate-pulse-border bg-alert/10 border border-alert/50 p-3 rounded relative overflow-hidden group hover:bg-alert/20 transition-colors cursor-pointer">
                                <div className="absolute top-0 right-0 p-1">
                                    <ShieldAlert className="text-alert w-4 h-4" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-alert font-bold border border-alert/30 px-1 rounded">CRITICAL</span>
                                        <span className="text-[10px] font-mono text-slate-300">{new Date(alert.createdAt || Date.now()).toLocaleTimeString()}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-white font-display mb-1">{alert.type.replace('_', ' ')}</h4>
                                    <p className="text-xs text-slate-400 mb-2 truncate">Node ID: {alert.cameraId} | Threat: {Number(alert.threatScore || 0).toFixed(0)}</p>

                                    {alert.evidenceImageUrl && (
                                        <div className="w-full h-16 bg-black border border-slate-700/50 rounded mb-2 overflow-hidden">
                                            <img src={`http://localhost:5000${alert.evidenceImageUrl}`} className="w-full h-full object-cover" alt="Evidence" />
                                        </div>
                                    )}

                                    <div className="mt-1 flex gap-2">
                                        <Button variant="alert" size="sm" className="flex-1">Dispatch</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};
