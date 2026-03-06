import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldAlert, Ban, Search, Filter, Activity, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { clsx } from 'clsx';

export const AdminBlacklist: React.FC = () => {
    const navigate = useNavigate();
    const [flaggedVehicles, setFlaggedVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchList = async () => {
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
            const res = await axios.get(`${apiUrl}/vehicles/blacklist`, { headers });
            setFlaggedVehicles(res.data || []);
        } catch (error) {
            console.error("Failed to fetch blacklist", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    const handleRemove = async (plateNumber: string) => {
        if (!window.confirm(`Are you sure you want to remove ${plateNumber} from the blacklist?`)) return;

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
            await axios.delete(`${apiUrl}/vehicles/${plateNumber}/blacklist`, { headers });

            // Optimistic UI update
            setFlaggedVehicles(prev => prev.filter(v => v.plateNumber !== plateNumber));
        } catch (error) {
            console.error("Failed to remove vehicle from blacklist", error);
        }
    };

    const filteredVehicles = flaggedVehicles.filter(v =>
        v.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.blacklistReason || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const blacklistedCount = flaggedVehicles.filter(v => v.isBlacklisted).length;
    const watchlistedCount = flaggedVehicles.filter(v => v.isWatchlisted && !v.isBlacklisted).length;

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                    <h2 className="font-display font-black text-3xl text-alert uppercase tracking-widest flex items-center gap-3">
                        <Ban className="text-white w-8 h-8" /> ENFORCEMENT BLACKLIST
                    </h2>
                    <p className="text-slate-400 font-mono text-sm mt-2 tracking-wide">
                        Global registry of high-threat vehicles and operational watchlists.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="glass-panel p-3 px-6 rounded-lg border-alert/30 text-center">
                        <div className="text-[10px] text-alert font-mono uppercase tracking-widest mb-1">Blacklisted</div>
                        <div className="text-2xl font-black text-white">{blacklistedCount}</div>
                    </div>
                    <div className="glass-panel p-3 px-6 rounded-lg border-warning/30 text-center">
                        <div className="text-[10px] text-warning font-mono uppercase tracking-widest mb-1">Watchlisted</div>
                        <div className="text-2xl font-black text-white">{watchlistedCount}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 glass-panel rounded-xl border-alert/20 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="SEARCH PLATES OR REASONS..."
                            className="w-full bg-slate-900/50 border border-slate-700 rounded pl-9 pr-4 py-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono text-xs hover:border-primary/50 transition-colors">
                        <Filter className="w-4 h-4" />
                        FILTER STATUS
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="size-10 border-2 border-alert/20 border-t-alert rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-[#0f172a] border-b border-alert/20 z-10 shadow-lg">
                                <tr>
                                    <th className="p-4 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Target Entity</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Status / Risk</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Reason for Flagging</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Logged Date</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVehicles.map((vehicle) => (
                                    <tr key={vehicle.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                        <td className="p-4">
                                            <div
                                                className="font-mono text-lg font-black text-white cursor-pointer hover:text-primary transition-colors tracking-widest"
                                                onClick={() => navigate(`/vehicles/${vehicle.plateNumber}`)}
                                            >
                                                {vehicle.plateNumber}
                                            </div>
                                            <div className="text-[10px] mt-1 text-slate-500 font-mono flex items-center gap-1">
                                                <Activity size={10} /> {vehicle.totalViolations} LIFETIME VIOLATIONS
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <div className="flex flex-col gap-2 items-start">
                                                {vehicle.isBlacklisted ? (
                                                    <Badge variant="alert" className="animate-pulse shadow-neon-alert">BLACKLISTED</Badge>
                                                ) : (
                                                    <Badge variant="warning">WATCHLISTED</Badge>
                                                )}
                                                <div className={clsx(
                                                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                                    vehicle.riskLevel === 'CRITICAL' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                        vehicle.riskLevel === 'HIGH' ? 'bg-alert/20 text-alert border border-alert/30' : 'bg-slate-800 text-slate-400'
                                                )}>
                                                    RISK: {vehicle.riskLevel}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="p-4 max-w-sm">
                                            <div className="text-sm text-slate-300 font-mono truncate" title={vehicle.blacklistReason}>
                                                {vehicle.blacklistReason || <span className="text-slate-600 italic">No reason provided</span>}
                                            </div>
                                            <div className="text-[9px] text-slate-500 font-mono mt-1">
                                                ISSUED BY: {vehicle.blacklistedBy === 'SYSTEM' ? (
                                                    <span className="text-primary">SYSTEM AUTOMATION</span>
                                                ) : (
                                                    vehicle.blacklistedBy || 'UNKNOWN'
                                                )}
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <div className="text-sm font-mono text-slate-300">
                                                {vehicle.blacklistedAt ? new Date(vehicle.blacklistedAt).toLocaleDateString() : 'N/A'}
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-500 mt-1">
                                                LAST SEEN: {vehicle.lastViolationAt ? new Date(vehicle.lastViolationAt).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-[10px]"
                                                    onClick={() => navigate(`/vehicles/${vehicle.plateNumber}`)}
                                                >
                                                    DOSSIER
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-[10px] !border-alert/30 !text-alert hover:!bg-alert/10"
                                                    onClick={() => handleRemove(vehicle.plateNumber)}
                                                >
                                                    <Trash2 size={12} className="mr-1" /> PARDON
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {!loading && filteredVehicles.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-500">
                            <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-display font-bold text-white mb-2 uppercase tracking-widest">No Active Threats</h3>
                            <p className="font-mono text-xs">The enforcement registry is currently clear of flagged entities.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
