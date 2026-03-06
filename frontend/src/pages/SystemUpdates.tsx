import React, { useEffect, useMemo, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Clock3,
    Sparkles,
    Wrench,
    ShieldCheck,
    Gauge,
    Bug
} from 'lucide-react';

interface LatestVersionPayload {
    currentVersion?: string;
    lastUpdated?: string;
}

interface PatchNote {
    id: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    component: string;
}

interface SystemVersionEntry {
    id: string;
    versionNumber: string;
    releaseName: string;
    releaseType: string;
    releaseDate?: string | null;
    releaseStatus?: string;
    createdAt: string;
    patchNotes: PatchNote[];
}

type PatchCategoryKey = 'feature' | 'improvement' | 'fix' | 'security' | 'performance' | 'other';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const categoryMeta: Record<PatchCategoryKey, {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
}> = {
    feature: {
        label: 'FEATURE',
        icon: Sparkles,
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-400/40'
    },
    improvement: {
        label: 'IMPROVEMENT',
        icon: Wrench,
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
    },
    fix: {
        label: 'FIX',
        icon: Bug,
        badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-400/40'
    },
    security: {
        label: 'SECURITY',
        icon: ShieldCheck,
        badgeClass: 'bg-red-500/15 text-red-300 border-red-400/40'
    },
    performance: {
        label: 'PERFORMANCE',
        icon: Gauge,
        badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/40'
    },
    other: {
        label: 'OTHER',
        icon: Clock3,
        badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-400/40'
    }
};

const categoryOrder: PatchCategoryKey[] = [
    'feature',
    'improvement',
    'fix',
    'security',
    'performance',
    'other'
];

const normalizeCategory = (value: string): PatchCategoryKey => {
    const normalized = value.toLowerCase();
    if (normalized.includes('feature')) return 'feature';
    if (normalized.includes('improvement')) return 'improvement';
    if (normalized.includes('fix') || normalized.includes('bug')) return 'fix';
    if (normalized.includes('security')) return 'security';
    if (normalized.includes('performance')) return 'performance';
    return 'other';
};

const formatReleaseDate = (value?: string | null): string => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const releaseTypeClass = (releaseType: string): string => {
    const normalized = releaseType.toLowerCase();
    if (normalized === 'major') return 'bg-primary/20 text-primary border-primary/40';
    if (normalized === 'minor') return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
    if (normalized === 'patch') return 'bg-orange-500/20 text-orange-300 border-orange-400/40';
    return 'bg-violet-500/20 text-violet-300 border-violet-400/40';
};

export const SystemUpdates: React.FC = () => {
    const [latestVersion, setLatestVersion] = useState<LatestVersionPayload | null>(null);
    const [history, setHistory] = useState<SystemVersionEntry[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            const headers: HeadersInit = {
                Authorization: `Bearer ${localStorage.getItem('token') || ''}`
            };

            try {
                const [latestResponse, historyResponse] = await Promise.all([
                    fetch(`${API_URL}/system/version/latest`, { headers }),
                    fetch(`${API_URL}/system/history`, { headers })
                ]);

                if (!historyResponse.ok) {
                    setError('Failed to fetch release history.');
                    setLoading(false);
                    return;
                }

                const historyPayload = await historyResponse.json() as SystemVersionEntry[];
                const sortedHistory = [...historyPayload].sort((a, b) => {
                    const aTime = new Date(a.releaseDate || a.createdAt).getTime();
                    const bTime = new Date(b.releaseDate || b.createdAt).getTime();
                    return bTime - aTime;
                });
                setHistory(sortedHistory);

                if (latestResponse.ok) {
                    const latestPayload = await latestResponse.json() as LatestVersionPayload;
                    setLatestVersion(latestPayload);
                } else {
                    setLatestVersion(null);
                }

                setExpanded(
                    sortedHistory.reduce<Record<string, boolean>>((acc, entry, index) => {
                        acc[entry.id] = index === 0;
                        return acc;
                    }, {})
                );
            } catch {
                setError('Unable to load system updates telemetry.');
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, []);

    const activeRelease = useMemo(() => {
        if (history.length === 0) return null;
        if (!latestVersion?.currentVersion) return history[0];
        return history.find((entry) => entry.versionNumber === latestVersion.currentVersion) || history[0];
    }, [history, latestVersion]);

    const toggleExpanded = (id: string) => {
        setExpanded((current) => ({
            ...current,
            [id]: !current[id]
        }));
    };

    return (
        <div className="h-full overflow-auto p-6 md:p-8">
            <section className="glass-panel rounded-2xl border-primary/20 bg-gradient-to-r from-slate-900/80 to-slate-900/30 p-6 md:p-8 mb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] font-mono text-primary mb-2">System Updates</p>
                        <h1 className="text-2xl md:text-3xl font-display font-bold uppercase tracking-wide text-white">
                            Version Intelligence Timeline
                        </h1>
                        <p className="text-xs md:text-sm text-slate-400 font-mono mt-2">
                            Track feature deployments, platform hardening, and operational patch history.
                        </p>
                    </div>
                    {loading ? (
                        <span className="text-xs text-slate-400 font-mono uppercase">Loading release state...</span>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-mono">Current Version</p>
                                <p className="text-lg font-display font-bold text-primary">{activeRelease?.versionNumber || latestVersion?.currentVersion || 'N/A'}</p>
                            </div>
                            <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-mono">Release Name</p>
                                <p className="text-sm font-semibold text-white truncate">{activeRelease?.releaseName || 'N/A'}</p>
                            </div>
                            <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-mono">Release Date</p>
                                <p className="text-sm font-semibold text-white">{formatReleaseDate(activeRelease?.releaseDate || latestVersion?.lastUpdated)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-mono">Status</p>
                                <p className="text-sm font-semibold text-emerald-300 uppercase">{(activeRelease?.releaseStatus || 'ACTIVE').toUpperCase()}</p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {error && (
                <div className="mb-4 rounded-lg border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert font-mono">
                    {error}
                </div>
            )}

            <section className="relative pl-6 md:pl-8">
                <div className="absolute left-2.5 md:left-3 top-1 bottom-1 w-px bg-gradient-to-b from-primary/70 via-slate-700 to-transparent" />

                <div className="space-y-5">
                    {history.map((version) => {
                        const isExpanded = expanded[version.id] ?? false;
                        const grouped = version.patchNotes.reduce<Record<PatchCategoryKey, PatchNote[]>>((acc, note) => {
                            const key = normalizeCategory(note.category);
                            acc[key].push(note);
                            return acc;
                        }, {
                            feature: [],
                            improvement: [],
                            fix: [],
                            security: [],
                            performance: [],
                            other: []
                        });

                        return (
                            <article key={version.id} className="relative rounded-xl border border-slate-700/70 bg-slate-950/60 backdrop-blur-sm">
                                <div className="absolute -left-[22px] md:-left-[25px] top-5 w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(0,240,255,0.9)]" />

                                <button
                                    type="button"
                                    className="w-full px-5 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors text-left"
                                    onClick={() => toggleExpanded(version.id)}
                                >
                                    <div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h2 className="text-lg font-display font-bold text-white tracking-wide">{version.versionNumber}</h2>
                                            <span className="text-sm text-slate-300 font-medium">{version.releaseName}</span>
                                            <span className={`text-[10px] uppercase tracking-[0.2em] font-mono px-2 py-1 border rounded ${releaseTypeClass(version.releaseType)}`}>
                                                {version.releaseType}
                                            </span>
                                        </div>
                                        <p className="text-xs font-mono text-slate-500 mt-1">
                                            {formatReleaseDate(version.releaseDate || version.createdAt)} • {(version.releaseStatus || 'released').toUpperCase()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono uppercase tracking-[0.16em]">
                                        {isExpanded ? 'Collapse Notes' : 'Expand Notes'}
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-5 md:px-6 pb-5 border-t border-slate-800/70">
                                        {version.patchNotes.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-4 py-4 mt-4 text-xs text-slate-500 font-mono uppercase tracking-wider">
                                                No patch notes published for this version.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                                                {categoryOrder
                                                    .filter((category) => grouped[category].length > 0)
                                                    .map((category) => {
                                                        const meta = categoryMeta[category];
                                                        const Icon = meta.icon;
                                                        return (
                                                            <section key={`${version.id}-${category}`} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] px-2.5 py-1 border rounded ${meta.badgeClass}`}>
                                                                        <Icon className="w-3.5 h-3.5" />
                                                                        {meta.label}
                                                                    </span>
                                                                </div>
                                                                <ul className="space-y-2">
                                                                    {grouped[category].map((note) => (
                                                                        <li key={note.id} className="text-sm text-slate-200 leading-snug">
                                                                            <p className="font-medium">{note.title}</p>
                                                                            <p className="text-xs text-slate-400 mt-1">{note.description}</p>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </section>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};
