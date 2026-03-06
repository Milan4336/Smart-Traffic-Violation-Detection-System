import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Table,
    Filter,
    Download,
    Search,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    AlertTriangle
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import clsx from 'clsx';

export const Logs: React.FC = () => {
    const navigate = useNavigate();
    const [violations, setViolations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Search & Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        type: 'ALL',
        riskLevel: 'ALL',
        cameraId: 'ALL',
        fineStatus: 'ALL',
        review_status: 'ALL',
        startDate: '',
        endDate: '',
        isBlacklisted: false
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });
    const [sort, setSort] = useState({ field: 'createdAt', order: 'desc' });
    const [showFilters, setShowFilters] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                sort_by: sort.field,
                sort_order: sort.order,
                ...(searchQuery && { plate_number: searchQuery }),
                ...(filters.type !== 'ALL' && { violation_type: filters.type }),
                ...(filters.riskLevel !== 'ALL' && { risk_level: filters.riskLevel }),
                ...(filters.cameraId !== 'ALL' && { camera_id: filters.cameraId }),
                ...(filters.fineStatus !== 'ALL' && { fine_status: filters.fineStatus }),
                ...(filters.review_status !== 'ALL' && { review_status: filters.review_status }),
                ...(filters.startDate && { start_date: filters.startDate }),
                ...(filters.endDate && { end_date: filters.endDate }),
                ...(filters.isBlacklisted && { is_blacklisted: 'true' })
            });

            const res = await fetch(`${apiUrl}/violations/search?${params.toString()}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setViolations(data.data || []);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, sort, filters, searchQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs();
        }, 300); // Debounce search
        return () => clearTimeout(timer);
    }, [fetchLogs]);

    const handleReset = () => {
        setSearchQuery('');
        setFilters({
            type: 'ALL',
            riskLevel: 'ALL',
            cameraId: 'ALL',
            fineStatus: 'ALL',
            review_status: 'ALL',
            startDate: '',
            endDate: '',
            isBlacklisted: false
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden bg-background-dark font-mono">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h2 className="font-display font-bold text-2xl text-white uppercase tracking-tighter flex items-center gap-3">
                        <Table className="text-primary w-6 h-6" /> Threat Repository
                    </h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                        Secured archival of AI-processed violation vectors
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="SEARCH PLATE VECTOR..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded px-10 py-2 text-xs text-white focus:outline-none focus:border-primary/50 transition-all w-64 uppercase"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded font-mono text-[10px] font-bold uppercase transition-all ${showFilters ? 'bg-primary text-black border-primary' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-primary/50'}`}
                    >
                        <Filter className="w-3.5 h-3.5" /> {showFilters ? 'HIDE FILTERS' : 'ADVANCED FILTERS'}
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded text-primary font-mono text-[10px] font-bold uppercase hover:bg-primary/20 transition-colors">
                        <Download className="w-3.5 h-3.5" /> EXPORT DATA
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="mb-6 p-6 bg-white/[0.02] border border-white/5 rounded-xl grid grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Infraction Type</label>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-primary/30"
                        >
                            <option value="ALL">ALL TYPES</option>
                            <option value="NO_HELMET">NO HELMET</option>
                            <option value="RED_LIGHT">RED LIGHT</option>
                            <option value="WRONG_WAY">WRONG WAY</option>
                            <option value="OVERSPEED">OVERSPEED</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Threat Severity</label>
                        <select
                            value={filters.riskLevel}
                            onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-primary/30"
                        >
                            <option value="ALL">ALL LEVELS</option>
                            <option value="LOW">LOW RISK</option>
                            <option value="MEDIUM">MEDIUM RISK</option>
                            <option value="HIGH">HIGH RISK</option>
                            <option value="CRITICAL">CRITICAL</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Fine Resolution</label>
                        <select
                            value={filters.fineStatus}
                            onChange={(e) => setFilters({ ...filters, fineStatus: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-primary/30"
                        >
                            <option value="ALL">ALL RESOLUTIONS</option>
                            <option value="pending">PENDING</option>
                            <option value="paid">SETTLED</option>
                            <option value="waived">WAIVED</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Review Integrity</label>
                        <select
                            value={filters.review_status}
                            onChange={(e) => setFilters({ ...filters, review_status: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-primary/30"
                        >
                            <option value="ALL">ALL REVIEWS</option>
                            <option value="DETECTED">DETECTED</option>
                            <option value="UNDER_REVIEW">UNDER REVIEW</option>
                            <option value="APPROVED">APPROVED</option>
                            <option value="REJECTED">REJECTED</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Node Affinity</label>
                        <select
                            value={filters.cameraId}
                            onChange={(e) => setFilters({ ...filters, cameraId: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-primary/30"
                        >
                            <option value="ALL">ALL NODES</option>
                            <option value="CAM_01">INTERSECTION A</option>
                            <option value="CAM_02">NORTH HIGHWAY</option>
                        </select>
                    </div>
                    <div className="col-span-2 space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Temporal Window (Start - End)</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="flex-1 bg-black/60 border border-white/10 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-primary/30"
                            />
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="flex-1 bg-black/60 border border-white/10 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-primary/30"
                            />
                        </div>
                    </div>
                    <div className="flex items-end gap-3">
                        <label className="flex items-center gap-3 cursor-pointer group bg-black/40 border border-white/10 rounded p-2 mb-0.5">
                            <input
                                type="checkbox"
                                checked={filters.isBlacklisted}
                                onChange={(e) => setFilters({ ...filters, isBlacklisted: e.target.checked })}
                                className="size-3 accent-primary"
                            />
                            <span className="text-[10px] text-slate-400 group-hover:text-primary transition-colors flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> BLACKLISTED ONLY
                            </span>
                        </label>
                        <button
                            onClick={handleReset}
                            className="mb-0.5 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            title="Reset Matrix"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Table Section */}
            <div className="flex-1 glass-panel rounded-xl border border-white/[0.03] overflow-hidden flex flex-col relative">
                {loading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-20 flex items-center justify-center">
                        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[#0D1117] border-b border-primary/20 z-10">
                            <tr>
                                <th onClick={() => setSort({ field: 'createdAt', order: sort.order === 'asc' ? 'desc' : 'asc' })} className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">Timestamp</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Plate Vector</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Classification</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Source Node</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Review</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Risk Level</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Resolution</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {violations.map((v, i) => (
                                <tr key={v.id || i} className="hover:bg-primary/[0.02] transition-colors group">
                                    <td className="p-4 text-[10px] font-mono text-slate-400">
                                        {new Date(v.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-4 text-xs font-mono font-bold tracking-[0.2em]">
                                        <div className="flex flex-col">
                                            <span
                                                className="text-white hover:text-primary cursor-pointer transition-colors"
                                                onClick={() => navigate(`/vehicles/${v.plateNumber}`)}
                                            >
                                                {v.plateNumber || 'UNIDENTIFIED'}
                                            </span>
                                            {v.vehicle?.isBlacklisted && <span className="text-[8px] text-red-500 font-bold uppercase mt-0.5">● Blacklisted</span>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-alert animate-pulse shadow-neon-alert"></div>
                                            <span className="text-[10px] font-bold text-alert uppercase tracking-tighter">
                                                {v.type.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-[10px] font-mono text-slate-500">
                                            {v.camera?.name || v.cameraId.slice(0, 8)}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className={clsx(
                                            "inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-tighter shadow-sm",
                                            v.reviewStatus === 'APPROVED' ? "bg-success/10 text-success border-success/20" :
                                                v.reviewStatus === 'REJECTED' ? "bg-alert/10 text-alert border-alert/20" :
                                                    v.reviewStatus === 'UNDER_REVIEW' ? "bg-warning/10 text-warning border-warning/20" :
                                                        "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                        )}>
                                            {v.reviewStatus?.replace('_', ' ') || 'DETECTED'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Badge variant={v.vehicle?.riskLevel === 'CRITICAL' ? 'alert' : v.vehicle?.riskLevel === 'HIGH' ? 'warning' : 'primary'}>
                                            {v.vehicle?.riskLevel || 'LOW'}
                                        </Badge>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-mono ${v.fineStatus === 'paid' ? 'text-success' : 'text-slate-400'}`}>
                                                {v.fineStatus === 'paid' ? 'SETTLED' : `PENDING ₹${v.fineAmount || 0}`}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {violations.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center p-20 gap-4">
                            <Filter className="w-12 h-12 text-slate-800" />
                            <div className="text-center">
                                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">No Intelligence Matches</p>
                                <p className="text-[10px] text-slate-600 mt-1">Adjust filters or search parameters to expand repository scan</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-white/5 bg-[#0D1117] flex items-center justify-between shrink-0">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                        Intelligence Stream: <span className="text-white font-bold">{Math.min(pagination.total, (pagination.page - 1) * pagination.limit + 1)}</span>
                        - <span className="text-white font-bold">{Math.min(pagination.total, pagination.page * pagination.limit)}</span> of <span className="text-primary font-bold">{pagination.total}</span> vectors
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={pagination.page <= 1}
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            className="p-1.5 border border-white/10 rounded hover:border-primary/50 disabled:opacity-30 transition-all text-slate-400 hover:text-primary"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                            {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPagination(p => ({ ...p, page: pageNum }))}
                                        className={`size-6 flex items-center justify-center rounded transition-all ${pagination.page === pageNum ? 'bg-primary text-black font-bold shadow-neon' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {pagination.totalPages > 5 && <span className="text-slate-700 px-1">...</span>}
                        </div>
                        <button
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            className="p-1.5 border border-white/10 rounded hover:border-primary/50 disabled:opacity-30 transition-all text-slate-400 hover:text-primary"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
