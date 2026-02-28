import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, ShieldAlert, Filter, Download } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

export const Logs: React.FC = () => {
    const navigate = useNavigate();
    const [violations, setViolations] = useState<any[]>([]);

    useEffect(() => {
        const fetchLogs = async () => {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

            try {
                const res = await fetch(`${apiUrl}/violations?limit=50`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setViolations(data.data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchLogs();
    }, []);

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                    <h2 className="font-display font-bold text-2xl text-white uppercase tracking-widest flex items-center gap-3">
                        <Table className="text-primary w-6 h-6" /> THREAT LOGS
                    </h2>
                    <p className="text-slate-400 font-mono text-sm mt-1">Chronological archive of all AI-detected infractions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono text-xs hover:border-primary/50 transition-colors">
                        <Filter className="w-4 h-4" />
                        FILTER DB
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded text-primary font-mono text-xs hover:bg-primary/20 transition-colors">
                        <Download className="w-4 h-4" />
                        EXPORT CSV
                    </button>
                </div>
            </div>

            <div className="flex-1 glass-panel rounded-lg border border-slate-800/50 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-900 border-b border-primary/20 z-10">
                        <tr>
                            <th className="p-4 text-xs font-mono text-slate-400 font-normal">TIMESTAMP</th>
                            <th className="p-4 text-xs font-mono text-slate-400 font-normal">PLATE #</th>
                            <th className="p-4 text-xs font-mono text-slate-400 font-normal">CLASSIFICATION</th>
                            <th className="p-4 text-xs font-mono text-slate-400 font-normal">NODE ID</th>
                            <th className="p-4 text-xs font-mono text-slate-400 font-normal">CONFIDENCE</th>
                            <th className="p-4 text-xs font-mono text-slate-400 font-normal">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {violations.map((v, i) => (
                            <tr key={v.id || i} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors group">
                                <td className="p-4 text-sm font-mono text-slate-300">
                                    {new Date(v.createdAt).toLocaleString()}
                                </td>
                                <td className="p-4 text-sm font-mono font-bold text-white tracking-widest">
                                    <span
                                        className="text-primary hover:text-white hover:underline cursor-pointer"
                                        onClick={() => navigate(`/vehicles/${v.plateNumber}`)}
                                    >
                                        {v.plateNumber || 'N/A'}
                                    </span>
                                </td>
                                <td className="p-4 text-sm font-display font-bold">
                                    <span className="text-alert bg-alert/10 px-2 py-1 rounded border border-alert/20 flex items-center gap-2 w-max">
                                        <ShieldAlert className="w-3 h-3" /> {v.type.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="p-4 text-sm font-mono text-slate-400">
                                    {v.cameraId}
                                </td>
                                <td className="p-4 text-sm font-mono text-white flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full ${v.confidenceScore > 90 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${v.confidenceScore}%` }}></div>
                                    </div>
                                    {v.confidenceScore.toFixed(1)}%
                                </td>
                                <td className="p-4">
                                    <Badge variant={v.status === 'verified' ? 'success' : v.status === 'rejected' ? 'alert' : 'primary'}>
                                        {v.status.toUpperCase()}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {violations.length === 0 && (
                    <div className="p-12 text-center text-slate-500 font-mono text-sm">NO THREAT LOGS FOUND</div>
                )}
            </div>
        </div>
    );
};
