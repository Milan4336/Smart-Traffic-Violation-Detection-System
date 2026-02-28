import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ViolationCard } from '../components/cards/ViolationCard';
import { ShieldAlert, Cpu, Video, Activity, Globe, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { socket } from '../socket';
import { LiveMap } from '../components/LiveMap';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { AlertPopup } from '../components/AlertPopup';

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
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState({ totalViolations: 0, todayViolations: 0, activeCameras: 0, avgConfidence: 0 });
    const [cameraStatus, setCameraStatus] = useState({ online_cameras: 0, offline_cameras: 0, health: 'UNKNOWN' });
    const [cameras, setCameras] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [activePopupAlert, setActivePopupAlert] = useState<any>(null);
    const [recentViolations, setRecentViolations] = useState<any[]>([]);
    const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
    const [selectedFine, setSelectedFine] = useState<any>(null);
    const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

            try {
                const [analyticsRes, camStatusRes, violationsRes, camerasRes, alertsRes] = await Promise.all([
                    fetch(`${apiUrl}/analytics`, { headers }),
                    fetch(`${apiUrl}/cameras/status`, { headers }),
                    fetch(`${apiUrl}/violations?limit=2`, { headers }),
                    fetch(`${apiUrl}/cameras`, { headers }),
                    fetch(`${apiUrl}/alerts`, { headers })
                ]);

                if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
                if (camStatusRes.ok) setCameraStatus(await camStatusRes.json());
                if (camerasRes.ok) setCameras(await camerasRes.json());
                if (alertsRes.ok) setAlerts(await alertsRes.json());
                if (violationsRes.ok) {
                    const data = await violationsRes.json();
                    setRecentViolations(data.data || []);
                    setLiveAlerts(data.data || []);
                }
            } catch (err) {
                console.error("Dashboard DB Sync Error", err);
            }
        };

        fetchDashboardData();

        // Socket Bindings
        socket.on('violation:new', (violationData) => {
            const violation = typeof violationData === 'string' ? JSON.parse(violationData) : violationData;
            setAnalytics(prev => ({
                ...prev,
                todayViolations: prev.todayViolations + 1,
                totalViolations: prev.totalViolations + 1
            }));

            setLiveAlerts(prev => [violation, ...prev].slice(0, 10));
            setRecentViolations(prev => [violation, ...prev].slice(0, 5));
        });

        socket.on('camera:offline', (cam) => {
            console.log("Camera Offline Alert", cam);
            setCameraStatus(prev => ({
                ...prev,
                offline_cameras: prev.offline_cameras + 1,
                online_cameras: Math.max(0, prev.online_cameras - 1),
                health: 'CRITICAL'
            }));
            setCameras(prev => prev.map(c => c.id === (cam.id || cam) ? { ...c, status: 'OFFLINE', healthStatus: 'OFFLINE' } : c));
        });

        socket.on('camera:degraded', (data) => {
            const cam = typeof data === 'string' ? JSON.parse(data) : data;
            setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, healthStatus: 'DEGRADED', currentFps: cam.fps, latencyMs: cam.latency } : c));
        });

        socket.on('camera:recovered', (data) => {
            const cam = typeof data === 'string' ? JSON.parse(data) : data;
            setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, healthStatus: 'HEALTHY', status: 'ONLINE' } : c));
        });

        socket.on('alert:new', (data) => {
            const alert = typeof data === 'string' ? JSON.parse(data) : data;
            setAlerts(prev => [alert, ...prev]);
            if (alert.alertType === 'CRITICAL' || alert.alertType === 'HIGH') {
                setActivePopupAlert(alert);
            }
        });

        socket.on('alert:status_change', (data) => {
            const update = typeof data === 'string' ? JSON.parse(data) : data;
            setAlerts(prev => prev.map(a => a.id === update.id ? { ...a, status: update.status } : a));
        });

        socket.on('fine:generated', (data) => {
            const fineData = typeof data === 'string' ? JSON.parse(data) : data;
            console.log("Fine Generated:", fineData);
            setLiveAlerts(prev => prev.map(a => a.id === fineData.violationId ? { ...a, fineAmount: fineData.fineAmount, fineStatus: 'pending' } : a));
            setRecentViolations(prev => prev.map(v => v.id === fineData.violationId ? { ...v, fineAmount: fineData.fineAmount, fineStatus: 'pending' } : v));
        });

        return () => {
            socket.off('violation:new');
            socket.off('camera:offline');
            socket.off('camera:degraded');
            socket.off('camera:recovered');
            socket.off('alert:new');
            socket.off('alert:status_change');
            socket.off('fine:generated');
        };
    }, []);

    const handleAcknowledgeAlert = async (id: string) => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        try {
            await fetch(`${apiUrl}/alerts/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: 'ACKNOWLEDGED' })
            });
            if (activePopupAlert?.id === id) setActivePopupAlert(null);
        } catch (err) {
            console.error("Failed to acknowledge alert", err);
        }
    };

    const handleResolveAlert = async (id: string) => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        try {
            await fetch(`${apiUrl}/alerts/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: 'RESOLVED' })
            });
            setAlerts(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error("Failed to resolve alert", err);
        }
    };

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
                                vehicle={v.vehicle}
                                fineAmount={v.fineAmount}
                                fineStatus={v.fineStatus}
                                onClick={() => setSelectedViolationId(v.id)}
                                onPlateClick={() => navigate(`/vehicles/${v.plateNumber}`)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Fine Details Modal */}
            {selectedFine && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-md p-6 rounded-lg border-alert/30 relative animate-in fade-in zoom-in duration-300">
                        <button
                            onClick={() => setSelectedFine(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >✕</button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="size-12 rounded-full bg-alert/20 flex items-center justify-center border border-alert/40 text-alert">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-display font-bold text-white uppercase tracking-tight">E-Challan Details</h3>
                                <p className="text-xs text-slate-400 font-mono">{selectedFine.plateNumber} • {selectedFine.violationType}</p>
                            </div>
                        </div>

                        <div className="space-y-4 font-mono">
                            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-slate-400">BASE FINE</span>
                                <span className="text-white font-bold">₹{selectedFine.calculation.baseAmount}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-slate-400">VEHICLE RISK</span>
                                <span className={clsx(
                                    "font-bold",
                                    selectedFine.calculation.riskLevel === 'CRITICAL' ? "text-alert" :
                                        selectedFine.calculation.riskLevel === 'HIGH' ? "text-alert/80" : "text-success"
                                )}>{selectedFine.calculation.riskLevel}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-slate-400">REPEAT MULTIPLIER</span>
                                <span className="text-warning font-bold">{selectedFine.calculation.appliedMultiplier}x</span>
                            </div>
                            <div className="flex justify-between items-center text-lg pt-2">
                                <span className="text-primary font-bold">TOTAL FINE</span>
                                <span className="text-alert font-bold text-2xl animate-pulse">₹{selectedFine.fineAmount}</span>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <Button variant="alert" className="flex-1 uppercase font-display font-bold text-xs" onClick={() => setSelectedFine(null)}>Close Matrix</Button>
                            <Button variant="primary" className="flex-1 uppercase font-display font-bold text-xs">Print Receipt</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Center Column: Live Map & Health Matrix (6 Cols) */}
            <section className="col-span-6 flex flex-col h-full gap-4 relative">
                <div className="flex-1 flex flex-col min-h-0">
                    <h2 className="font-display font-bold text-lg text-white/80 uppercase tracking-widest flex items-center gap-2 mb-4 relative z-10">
                        <Globe className="text-primary w-4 h-4" /> GEOSPATIAL MATRIX
                    </h2>
                    <div className="flex-1 rounded-lg relative overflow-hidden scanline-effect group border border-slate-700/50">
                        <LiveMap cameras={cameras} violations={liveAlerts} />
                    </div>
                </div>

                <div className="h-1/3 glass-panel rounded-lg overflow-hidden flex flex-col border-primary/20">
                    <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h3 className="text-xs font-display font-bold text-primary flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" /> NODE OPERATIONS MATRIX
                        </h3>
                        <span className="text-[10px] font-mono text-slate-500">REAL-TIME STABILITY TRACKING</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-[#0f172a] text-[10px] text-slate-500 uppercase font-display border-b border-white/5">
                                <tr>
                                    <th className="p-3 font-bold">Node ID</th>
                                    <th className="p-3 font-bold">FPS</th>
                                    <th className="p-3 font-bold">Latency</th>
                                    <th className="p-3 font-bold">Stability</th>
                                    <th className="p-3 font-bold text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-mono">
                                {cameras.map((cam, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-3 text-white font-bold">{cam.name}</td>
                                        <td className="p-3 text-slate-400">{cam.currentFps?.toFixed(1) || '0.0'}</td>
                                        <td className="p-3 text-slate-400">{cam.latencyMs || '0'}ms</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={clsx(
                                                            "h-full transition-all duration-500",
                                                            cam.healthStatus === 'HEALTHY' ? "bg-success w-full" :
                                                                cam.healthStatus === 'DEGRADED' ? "bg-warning w-1/2" : "bg-alert w-0"
                                                        )}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className={clsx(
                                                "px-2 py-0.5 rounded text-[10px] font-bold",
                                                cam.healthStatus === 'HEALTHY' ? "bg-success/20 text-success border border-success/30" :
                                                    cam.healthStatus === 'DEGRADED' ? "bg-warning/20 text-warning border border-warning/30" :
                                                        "bg-alert/20 text-alert border border-alert/30 animate-pulse"
                                            )}>
                                                {cam.healthStatus || 'OFFLINE'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Right Column: Live Alerts & intelligence (3 Cols) */}
            <section className="col-span-3 flex flex-col h-full gap-4 overflow-hidden">
                <div className="h-1/2 glass-panel rounded-lg overflow-hidden flex flex-col border-alert/20">
                    <div className="p-3 border-b border-white/10 bg-alert/5 flex justify-between items-center">
                        <h3 className="text-xs font-display font-bold text-alert flex items-center gap-2 uppercase tracking-tight">
                            <ShieldAlert className="w-3.5 h-3.5" /> Command Alerts
                        </h3>
                        <div className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-alert animate-pulse"></span>
                            <span className="text-[10px] font-bold text-alert tracking-wider">LIVE</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 relative">
                        {alerts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 font-mono text-[10px] opacity-40">
                                <Bell className="w-8 h-8 mb-2" />
                                NO ACTIVE THREATS
                            </div>
                        ) : (
                            alerts.map((alert: any, idx: number) => (
                                <div key={idx} className={clsx(
                                    "p-3 rounded border font-mono text-[10px] transition-all relative overflow-hidden group",
                                    alert.status === 'ACTIVE' ? "bg-alert/10 border-alert/40 animate-pulse-border" : "bg-white/5 border-white/10 opacity-70"
                                )}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={clsx(
                                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                                            alert.alertType === 'CRITICAL' ? "bg-alert text-white" : "bg-warning text-background-dark"
                                        )}>
                                            {alert.alertType}
                                        </span>
                                        <span className="text-slate-500">{new Date(alert.createdAt || Date.now()).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="text-white font-bold text-xs mb-1">
                                        <span
                                            className="hover:text-primary hover:underline cursor-pointer"
                                            onClick={() => navigate(`/vehicles/${alert.plateNumber}`)}
                                        >
                                            {alert.plateNumber}
                                        </span> — {alert.type?.replace('_', ' ')}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mb-2">NODE: {alert.cameraId}</div>

                                    <div className="flex gap-1 mt-2">
                                        <button
                                            onClick={() => setSelectedViolationId(alert.violationId)}
                                            className="flex-1 bg-white/5 hover:bg-white/10 py-1 rounded border border-white/5 transition-colors uppercase font-bold text-[8px]"
                                        >
                                            Audit
                                        </button>
                                        {alert.status === 'ACTIVE' ? (
                                            <button
                                                onClick={() => handleAcknowledgeAlert(alert.id)}
                                                className="flex-1 bg-white/10 hover:bg-white/20 py-1 rounded border border-white/10 transition-colors uppercase font-bold text-[8px]"
                                            >
                                                Acknowledge
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleResolveAlert(alert.id)}
                                                className="flex-1 bg-success/20 hover:bg-success/30 text-success py-1 rounded border border-success/30 transition-colors uppercase font-bold text-[8px]"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex-1 glass-panel rounded-lg overflow-hidden flex flex-col border-primary/20">
                    <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h3 className="text-xs font-display font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                            <Activity className="w-3.5 h-3.5" /> System Logs
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-[10px]">
                        <div className="text-success animate-pulse mb-2">SYSTEM_STABLE: OPERATIONAL</div>
                        {liveAlerts.slice(0, 10).map((v, i) => (
                            <div key={i} className="border-l border-white/10 pl-3 py-1 text-slate-400 whitespace-pre-wrap">
                                <span className="text-primary opacity-50">[{new Date(v.createdAt).toLocaleTimeString()}]</span> REPORT_{v.type} DETECTED ON NODE_{v.cameraId}. CONF_{Math.floor(v.confidenceScore)}%
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            {selectedViolationId && (
                <EvidenceViewer
                    violationId={selectedViolationId}
                    onClose={() => setSelectedViolationId(null)}
                />
            )}

            {activePopupAlert && (
                <AlertPopup
                    alert={activePopupAlert}
                    onClose={() => setActivePopupAlert(null)}
                    onAcknowledge={handleAcknowledgeAlert}
                />
            )}
        </div>
    );
};
