import React, { useEffect, useState, useCallback } from 'react';
import {
    ShieldCheck,
    RotateCcw,
    ClipboardCheck,
    ChevronLeft,
    ChevronRight,
    Eye
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EvidenceViewer } from '../components/EvidenceViewer';

export const ReviewQueue: React.FC = () => {
    const [violations, setViolations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);

    // Filter States
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 15,
        total: 0,
        totalPages: 0
    });

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                review_status: 'UNDER_REVIEW'
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
            console.error("Failed to fetch review queue:", err);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const handleRefresh = () => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchQueue();
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden bg-background-dark font-mono">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h2 className="font-display font-bold text-2xl text-white uppercase tracking-tighter flex items-center gap-3">
                        <ClipboardCheck className="text-primary w-6 h-6" /> Review Queue
                    </h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                        Pending verification of AI-flagged traffic infractions
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                        <RotateCcw className="w-3.5 h-3.5" /> REFRESH QUEUE
                    </Button>
                </div>
            </div>

            {/* Table */}
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
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Detected At</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Plate Number</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Violation Type</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Source Node</th>
                                <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {violations.map((v) => (
                                <tr key={v.id} className="hover:bg-primary/[0.02] transition-colors group">
                                    <td className="p-4 text-[10px] font-mono text-slate-400">
                                        {new Date(v.createdAt).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-xs font-mono font-bold tracking-[0.2em] text-white">
                                        {v.plateNumber || 'UNIDENTIFIED'}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-alert uppercase">
                                                {v.type.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-[10px] font-mono text-slate-500">
                                        {v.camera?.name || v.cameraId.slice(0, 8)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            className="text-[9px] font-bold h-7 gap-1.5"
                                            onClick={() => setSelectedViolationId(v.id)}
                                        >
                                            <Eye size={12} /> REVIEW EVIDENCE
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {violations.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center p-20 gap-4 text-center">
                            <ShieldCheck className="w-12 h-12 text-success/20" />
                            <div>
                                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Queue Clear</p>
                                <p className="text-[10px] text-slate-600 mt-1">All detected violations have been processed.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-white/5 bg-[#0D1117] flex items-center justify-between shrink-0">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                        Pending Reviews: <span className="text-primary font-bold">{pagination.total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={pagination.page <= 1}
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            className="p-1.5 border border-white/10 rounded disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                        </button>
                        <span className="text-[10px] text-white">PAGE {pagination.page} OF {pagination.totalPages || 1}</span>
                        <button
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            className="p-1.5 border border-white/10 rounded disabled:opacity-30"
                        >
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedViolationId && (
                <EvidenceViewer
                    violationId={selectedViolationId}
                    onClose={() => {
                        setSelectedViolationId(null);
                        fetchQueue(); // Refresh queue after review
                    }}
                />
            )}
        </div>
    );
};
