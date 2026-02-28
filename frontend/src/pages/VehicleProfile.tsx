import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Car, Target, ShieldAlert, Activity, MapPin, Calendar, Clock,
    ArrowLeft, ExternalLink, Ban, Flag, TrendingUp, AlertTriangle,
    CheckCircle, Info, DollarSign, Camera
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../components/ui/Button';
import { EvidenceViewer } from '../components/EvidenceViewer';
import clsx from 'clsx';

// Fix for default marker icons in Leaflet with React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export const VehicleProfile: React.FC = () => {
    const { plateNumber } = useParams<{ plateNumber: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);

    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`${apiUrl}/vehicles/${plateNumber}/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setProfile(res.data);
            } catch (err: any) {
                console.error("Failed to fetch vehicle profile", err);
                setError(err.response?.data?.error || "Failed to load vehicle intelligence profile");
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [plateNumber]);

    const handleToggleBlacklist = async () => {
        try {
            const res = await axios.patch(`${apiUrl}/vehicles/${plateNumber}/blacklist`,
                { isBlacklisted: !profile.summary.isBlacklisted },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setProfile({ ...profile, summary: { ...profile.summary, isBlacklisted: res.data.isBlacklisted, riskLevel: res.data.riskLevel } });
        } catch (err) {
            console.error("Failed to update blacklist status", err);
        }
    };

    if (loading) return (
        <div className="flex-1 flex items-center justify-center bg-background-dark">
            <div className="flex flex-col items-center gap-4">
                <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <div className="font-mono text-xs text-primary animate-pulse tracking-widest uppercase">Fetching Interpol Database...</div>
            </div>
        </div>
    );

    if (error || !profile) return (
        <div className="flex-1 flex items-center justify-center bg-background-dark p-8">
            <div className="glass-panel p-8 rounded-xl border-alert/30 text-center max-w-md">
                <AlertTriangle className="size-12 text-alert mx-auto mb-4" />
                <h2 className="text-xl font-display font-black text-white uppercase mb-2">Access Denied / Profile Not Found</h2>
                <p className="text-slate-400 text-sm mb-6">{error || "The requested plate number does not exist in the enforcement database."}</p>
                <Button onClick={() => navigate(-1)} variant="primary" className="w-full">
                    <ArrowLeft className="mr-2" size={16} /> RETURN TO COMMAND
                </Button>
            </div>
        </div>
    );

    const { summary, analytics, history } = profile;

    // Prepare chart data (violations by date)
    const historyByDate = history.reduce((acc: any, v: any) => {
        const date = new Date(v.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});
    const chartData = Object.entries(historyByDate).map(([date, count]) => ({ date, count })).reverse();

    const riskLevelData = {
        'LOW': { color: 'text-success border-success/30 bg-success/10', label: 'LOW' },
        'MEDIUM': { color: 'text-warning border-warning/30 bg-warning/10', label: 'MEDIUM' },
        'HIGH': { color: 'text-alert border-alert/30 bg-alert/10', label: 'HIGH' },
        'CRITICAL': { color: 'text-purple-500 border-purple-500/30 bg-purple-500/10', label: 'CRITICAL' }
    };
    const risk = riskLevelData[summary.riskLevel as keyof typeof riskLevelData] || riskLevelData['LOW'];

    const isRepeatOffender = summary.totalViolations >= 3;
    const isCriticalOffender = summary.totalViolations >= 10;

    return (
        <div className="flex-1 flex flex-col bg-background-dark overflow-y-auto p-4 md:p-8">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase leading-none">
                        Vehicle Intelligence Profile
                    </h1>
                    <p className="text-[10px] text-primary font-mono tracking-[0.3em] uppercase mt-1">Plate: {plateNumber} • Forensic Dossier</p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Left Column: Summary & Analytics (4 Cols) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    {/* Summary Card */}
                    <div className="glass-panel p-6 rounded-xl border-white/10 bg-white/5 flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <div className="size-14 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 text-primary shadow-neon">
                                <Car className="w-8 h-8" />
                            </div>
                            <div className={clsx("px-3 py-1 rounded border font-mono font-black text-xs", risk.color)}>
                                RISK: {risk.label}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1 block">Registration Plate</label>
                                <div className="text-4xl font-mono font-black text-white tracking-widest border-b-2 border-primary/40 inline-block">
                                    {summary.plateNumber}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-3 rounded border border-white/5">
                                    <label className="text-[9px] text-slate-500 font-mono uppercase block mb-1">Total Violations</label>
                                    <div className="text-xl font-display font-black text-white">{summary.totalViolations}</div>
                                </div>
                                <div className="bg-alert/10 p-3 rounded border border-alert/20">
                                    <label className="text-[9px] text-alert font-mono uppercase block mb-1">Total Fines</label>
                                    <div className="text-xl font-display font-black text-white">₹{summary.totalFines.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="space-y-3 font-mono text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>First Sight:</span>
                                    <span className="text-white">{new Date(summary.firstSeen).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Last Active:</span>
                                    <span className="text-white">{new Date(summary.lastSeen).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Primary Node:</span>
                                    <span className="text-white">{summary.lastCameraId}</span>
                                </div>
                            </div>

                            {(isRepeatOffender || isCriticalOffender) && (
                                <div className={clsx(
                                    "p-3 rounded border font-display font-black text-center text-xs tracking-widest animate-pulse",
                                    isCriticalOffender ? "bg-alert text-white border-alert/50" : "bg-warning/20 text-warning border-warning/30"
                                )}>
                                    {isCriticalOffender ? 'CRITICAL OFFENDER ALERT' : 'REPEAT OFFENDER DETECTED'}
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex flex-col gap-2">
                            <Button
                                variant={summary.isBlacklisted ? 'alert' : 'outline'}
                                className="w-full font-bold text-xs"
                                onClick={handleToggleBlacklist}
                            >
                                <Ban size={16} className="mr-2" />
                                {summary.isBlacklisted ? 'REMOVE FROM BLACKLIST' : 'BLACKLIST VEHICLE'}
                            </Button>
                            <Button variant="outline" className="w-full font-bold text-xs text-primary border-primary/30 hover:bg-primary/5">
                                <Flag size={16} className="mr-2" /> FLAG FOR INTERCEPTION
                            </Button>
                        </div>
                    </div>

                    {/* Intelligence Metrics */}
                    <div className="glass-panel p-6 rounded-xl border-white/10 bg-white/5">
                        <h3 className="text-xs font-display font-bold text-primary flex items-center gap-2 uppercase tracking-widest mb-6 border-b border-primary/20 pb-2">
                            <Activity size={14} /> Pattern Intelligence
                        </h3>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="size-10 rounded bg-success/20 flex items-center justify-center text-success border border-success/30">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-mono uppercase">Activity Frequency</div>
                                    <div className="text-lg font-display font-black text-white">{analytics.avgViolationsPerWeek} / WEEK</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="size-10 rounded bg-warning/20 flex items-center justify-center text-warning border border-warning/30">
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-mono uppercase">Primary Modus Operandi</div>
                                    <div className="text-lg font-display font-black text-white uppercase">{analytics.mostCommonType.replace('_', ' ')}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="size-10 rounded bg-alert/20 flex items-center justify-center text-alert border border-alert/30">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-mono uppercase">Highest Fine Levy</div>
                                    <div className="text-lg font-display font-black text-white uppercase">₹{analytics.highestFine.amount} ({analytics.highestFine.type})</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Timeline & Map (8 Cols) */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    {/* Charts / Timeline */}
                    <div className="glass-panel p-6 rounded-xl border-white/10 bg-white/5 h-80 flex flex-col">
                        <h3 className="text-xs font-display font-bold text-primary flex items-center justify-between uppercase tracking-widest mb-6">
                            <span className="flex items-center gap-2"><TrendingUp size={14} /> Escalation Timeline</span>
                            <span className="text-[10px] text-slate-500 font-mono">VIOLATIONS OVER TIME</span>
                        </h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0A0A12', border: '1px solid #ffffff10', borderRadius: '8px' }}
                                        itemStyle={{ color: '#00E5FF', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="#00E5FF" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Geospatial Map */}
                    <div className="glass-panel rounded-xl border-white/10 bg-white/5 overflow-hidden h-96 flex flex-col">
                        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                            <h3 className="text-xs font-display font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                                <MapPin size={14} /> Operational Footprint
                            </h3>
                            <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">HISTORIC HEATMAP</span>
                        </div>
                        <div className="flex-1 relative z-0">
                            <MapContainer
                                center={[history[0]?.location?.lat || 28.6139, history[0]?.location?.lng || 77.2090]}
                                zoom={13}
                                className="w-full h-full"
                            >
                                <TileLayer
                                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                    attribution="&copy; OpenStreetMap contributors"
                                />
                                {history.filter((v: any) => v.location?.lat).map((v: any) => (
                                    <Marker
                                        key={v.id}
                                        position={[v.location.lat, v.location.lng]}
                                        icon={DefaultIcon}
                                    >
                                        <Popup className="dark-popup">
                                            <div className="bg-background-dark p-2 rounded text-white font-mono text-xs">
                                                <div className="text-primary font-bold mb-1 uppercase tracking-tight">{v.type}</div>
                                                <div className="opacity-60">{new Date(v.timestamp).toLocaleString()}</div>
                                                <div className="text-alert mt-1 font-black">₹{v.fineAmount}</div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </div>

                    {/* Violation History Table */}
                    <div className="glass-panel rounded-xl border-white/10 bg-white/5 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                            <h3 className="text-xs font-display font-bold text-alert flex items-center gap-2 uppercase tracking-widest">
                                <ShieldAlert size={14} /> Intelligence Log
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                                    <tr>
                                        <th className="p-4 border-b border-white/10">Timestamp</th>
                                        <th className="p-4 border-b border-white/10">Violation</th>
                                        <th className="p-4 border-b border-white/10">Node</th>
                                        <th className="p-4 border-b border-white/10">Levy</th>
                                        <th className="p-4 border-b border-white/10 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-[10px]">
                                    {history.map((v: any) => (
                                        <tr key={v.id} className="hover:bg-white/5 border-b border-white/5 transition-colors group">
                                            <td className="p-4">
                                                <div className="text-white group-hover:text-primary transition-colors">{new Date(v.timestamp).toLocaleDateString()}</div>
                                                <div className="text-[9px] text-slate-500">{new Date(v.timestamp).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white font-bold uppercase">{v.type.replace('_', ' ')}</div>
                                                <div className="text-[8px] text-primary">{Math.floor(v.confidenceScore)}% CONF</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                    <Camera size={10} className="text-primary" />
                                                    {v.cameraName}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white font-black">₹{v.fineAmount.toLocaleString()}</div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-[8px] font-bold h-7"
                                                    onClick={() => setSelectedViolationId(v.id)}
                                                >
                                                    AUDIT
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {selectedViolationId && (
                <EvidenceViewer
                    violationId={selectedViolationId}
                    onClose={() => setSelectedViolationId(null)}
                />
            )}
        </div>
    );
};
