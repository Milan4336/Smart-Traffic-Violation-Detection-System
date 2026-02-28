import React, { useEffect, useState } from 'react';
import { AlertTriangle, Filter } from 'lucide-react';

export const Updates: React.FC = () => {
    const [releases, setReleases] = useState<any[]>([]);

    useEffect(() => {
        const fetchUpdates = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const token = localStorage.getItem('token');
                const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

                const res = await fetch(`${apiUrl}/system/history`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setReleases(data);
                }
            } catch (err) {
                console.error("Failed to fetch system history", err);
            }
        };

        fetchUpdates();
    }, []);

    const getSeverityColor = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'critical': return 'text-destructive';
            case 'high': return 'text-warning';
            case 'medium': return 'text-yellow-400';
            default: return 'text-primary';
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white tracking-widest mb-2">SYSTEM ARCHIVES</h2>
                    <p className="text-slate-400 font-mono text-sm max-w-2xl">
                        A complete topological history of Core System iterations, patches, and threat responses.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono text-xs hover:border-primary/50 transition-colors">
                        <Filter className="w-4 h-4" />
                        FILTER BY COMPONENT
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary font-mono text-xs hover:bg-primary/30 transition-colors">
                        GENERATE REPORT
                    </button>
                </div>
            </div>

            <div className="relative border-l border-slate-700/50 pl-8 ml-4 space-y-12">
                {releases.map((release, index) => (
                    <div key={release.id} className="relative group">
                        {/* Timeline Node */}
                        <div className={`absolute -left-[41px] w-5 h-5 rounded-full border-4 border-background-dark flex items-center justify-center
                            ${index === 0 ? 'bg-primary shadow-[0_0_15px_rgba(0,255,163,0.5)]' : 'bg-slate-600'}`}>
                        </div>

                        {/* Release Header */}
                        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-slate-800/50 bg-slate-900/30 rounded-lg">
                            <div>
                                <h3 className="text-xl font-display font-bold text-white mb-1 flex items-center gap-3">
                                    <span className={index === 0 ? 'text-primary' : 'text-slate-300'}>{release.versionNumber}</span>
                                    <span className="text-sm font-normal text-slate-500 tracking-widest uppercase">— {release.releaseName}</span>
                                </h3>
                                <p className="text-xs font-mono text-slate-500">
                                    DEPLOYED: {new Date(release.releaseDate || release.createdAt).toLocaleString()} | TYPE: {release.releaseType.toUpperCase()}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded bg-primary/10 text-primary border border-primary/20`}>
                                    {release.releaseStatus.toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* Patch Notes Grid */}
                        {release.patchNotes && release.patchNotes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {release.patchNotes.map((patch: any) => (
                                    <div key={patch.id} className="p-4 bg-slate-900 border border-slate-800 rounded flex flex-col hover:border-slate-700 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase
                                                ${patch.category === 'feature' ? 'bg-primary/20 text-primary border border-primary/30' :
                                                    patch.category === 'fix' ? 'bg-warning/20 text-warning border border-warning/30' :
                                                        patch.category === 'security' ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-slate-800 text-slate-300'}`}>
                                                {patch.category}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {patch.severity === 'critical' ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> : null}
                                                <span className={`text-[10px] font-mono tracking-wider uppercase ${getSeverityColor(patch.severity)}`}>
                                                    {patch.severity}
                                                </span>
                                            </div>
                                        </div>
                                        <h4 className="text-sm font-medium text-slate-200 mb-2">{patch.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed font-mono flex-1">{patch.description}</p>

                                        <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-between text-[10px] font-mono text-slate-600">
                                            <span>MODULE: {patch.component.toUpperCase()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-900/50 border border-slate-800 border-dashed rounded text-center">
                                <span className="text-xs font-mono text-slate-500">NO PATCH DATA RECORDED FOR THIS VERSION</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
