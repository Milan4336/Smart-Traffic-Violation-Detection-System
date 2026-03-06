import React, { useMemo, useState } from 'react';
import {
    Activity,
    Bot,
    Camera,
    Database,
    HardDrive,
    RefreshCw,
    Server,
    Timer,
    View,
    Workflow,
    AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSystemStatus, type HealthState, type ServiceHealth } from '../contexts/SystemStatusContext';

const ROW_HEIGHT = 58;
const TABLE_VIEWPORT_HEIGHT = 320;

const statusClassMap: Record<HealthState, string> = {
    HEALTHY: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/40',
    DEGRADED: 'text-amber-300 bg-amber-500/15 border-amber-400/40',
    OFFLINE: 'text-red-300 bg-red-500/15 border-red-400/40',
    STARTING: 'text-sky-300 bg-sky-500/15 border-sky-400/40'
};

const severityClassMap = {
    INFO: 'border-sky-400/30 text-sky-200 bg-sky-500/10',
    WARN: 'border-amber-400/30 text-amber-200 bg-amber-500/10',
    CRITICAL: 'border-red-400/30 text-red-200 bg-red-500/10'
} as const;

const formatClock = (value: string): string => {
    if (!value || value.startsWith('1970-')) return 'Awaiting telemetry';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Awaiting telemetry';
    return date.toLocaleTimeString();
};

const formatLatency = (value: number | null): string => {
    if (value === null) return 'N/A';
    return `${value} ms`;
};

const statusPill = (status: HealthState) => (
    <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] border rounded ${statusClassMap[status]}`}>
        {status}
    </span>
);

const StatusCard: React.FC<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    service: ServiceHealth;
}> = ({ title, icon: Icon, service }) => (
    <article className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
            <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">{title}</p>
                <p className="text-xs text-slate-400 mt-1">Last check: {formatClock(service.lastCheck)}</p>
            </div>
            <div className="p-2 rounded-lg border border-slate-700 bg-slate-900/70">
                <Icon className="w-4 h-4 text-primary" />
            </div>
        </div>
        <div className="mb-3">{statusPill(service.status)}</div>
        <p className="text-xs text-slate-300 leading-snug min-h-8">{service.detail}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-slate-800 bg-slate-900/50 px-2 py-2">
                <p className="text-slate-500 font-mono uppercase tracking-[0.12em]">Latency</p>
                <p className="text-slate-100 font-semibold">{formatLatency(service.latencyMs)}</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 px-2 py-2">
                <p className="text-slate-500 font-mono uppercase tracking-[0.12em]">{service.metricLabel || 'Metric'}</p>
                <p className="text-slate-100 font-semibold">{service.metricValue || 'N/A'}</p>
            </div>
        </div>
    </article>
);

export const SystemStatus: React.FC = () => {
    const { snapshot, incidents, loading, refresh } = useSystemStatus();
    const [cameraTableScroll, setCameraTableScroll] = useState(0);

    const dbActiveConnections = useMemo(() => {
        const metricCandidates = [
            snapshot.metrics.db_active_connections,
            snapshot.metrics.database_active_connections,
            snapshot.metrics.active_connections
        ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        if (metricCandidates.length > 0) return String(metricCandidates[0]);
        return 'N/A';
    }, [snapshot.metrics]);

    const visibleWindow = useMemo(() => {
        const totalRows = snapshot.cameraRows.length;
        const startIndex = Math.max(0, Math.floor(cameraTableScroll / ROW_HEIGHT) - 2);
        const rowsPerViewport = Math.ceil(TABLE_VIEWPORT_HEIGHT / ROW_HEIGHT) + 5;
        const endIndex = Math.min(totalRows, startIndex + rowsPerViewport);
        const offsetTop = startIndex * ROW_HEIGHT;
        return {
            startIndex,
            endIndex,
            offsetTop,
            rows: snapshot.cameraRows.slice(startIndex, endIndex),
            totalHeight: totalRows * ROW_HEIGHT
        };
    }, [cameraTableScroll, snapshot.cameraRows]);

    const cards = [
        { title: 'System Status', icon: Activity, service: snapshot.services.system },
        { title: 'AI / ML Service Status', icon: Bot, service: snapshot.services.ai },
        { title: 'Camera Network Status', icon: Camera, service: snapshot.services.cameras },
        { title: 'Database Status', icon: Database, service: snapshot.services.database },
        { title: 'Redis Queue Status', icon: Workflow, service: snapshot.services.redis },
        { title: 'API Status', icon: Server, service: snapshot.services.api },
        { title: 'Storage Status', icon: HardDrive, service: snapshot.services.storage }
    ];

    return (
        <div className="h-full overflow-auto p-6 md:p-8 space-y-6">
            <section className="glass-panel rounded-2xl border-primary/20 bg-gradient-to-r from-slate-900/80 to-slate-900/20 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] font-mono text-primary mb-2">System Status</p>
                        <h1 className="text-2xl md:text-3xl font-display font-bold uppercase tracking-wide text-white">
                            Real-Time Infrastructure Monitor
                        </h1>
                        <p className="text-xs md:text-sm text-slate-400 font-mono mt-2">
                            Health telemetry for backend API, AI pipeline, camera network, queue, storage, and data services.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {statusPill(snapshot.services.system.status)}
                        <button
                            type="button"
                            onClick={() => void refresh()}
                            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] px-3 py-2 rounded border border-slate-700 bg-slate-900/60 text-slate-200 hover:border-primary/60 hover:text-primary transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>
                <div className="mt-4 text-xs text-slate-500 font-mono uppercase tracking-[0.15em]">
                    Last telemetry sync: {formatClock(snapshot.lastUpdated)}
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <StatusCard key={card.title} title={card.title} icon={card.icon} service={card.service} />
                ))}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <article className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-5">
                    <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-400 mb-4">AI / ML Runtime</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Model Version</span>
                            <span className="text-white font-semibold">{snapshot.aiModel.modelVersion}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Model Loaded</span>
                            <span className={snapshot.aiModel.modelLoaded ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold'}>
                                {snapshot.aiModel.modelLoaded ? 'Running' : 'Unavailable'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">GPU Usage</span>
                            <span className="text-white font-semibold">
                                {snapshot.aiModel.gpuUsagePercent !== null ? `${snapshot.aiModel.gpuUsagePercent}%` : 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Inference Latency</span>
                            <span className="text-white font-semibold">{formatLatency(snapshot.aiModel.inferenceLatencyMs)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Active AI Jobs</span>
                            <span className="text-white font-semibold">{snapshot.aiModel.activeAiJobs}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">OCR Pipeline</span>
                            <span className="text-white font-semibold">
                                {snapshot.aiModel.ocrEnabled === null ? 'Unknown' : (snapshot.aiModel.ocrEnabled ? 'Enabled' : 'Disabled')}
                            </span>
                        </div>
                    </div>
                </article>

                <article className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-5">
                    <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-400 mb-4">Redis Queue Metrics</h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-mono">Pending Jobs</p>
                            <p className="text-lg font-semibold text-white">{snapshot.queue.pendingJobs}</p>
                        </div>
                        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-mono">Processing Jobs</p>
                            <p className="text-lg font-semibold text-white">{snapshot.queue.processingJobs}</p>
                        </div>
                        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-mono">Failed Jobs</p>
                            <p className="text-lg font-semibold text-alert">{snapshot.queue.failedJobs}</p>
                        </div>
                        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-mono">Avg Process Time</p>
                            <p className="text-lg font-semibold text-white">
                                {snapshot.queue.averageProcessingTimeMs !== null ? `${snapshot.queue.averageProcessingTimeMs} ms` : 'N/A'}
                            </p>
                        </div>
                    </div>
                </article>

                <article className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-5">
                    <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-400 mb-4">Database Monitor</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Connection Status</span>
                            <span className="font-semibold text-white">{snapshot.services.database.status}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Query Latency</span>
                            <span className="font-semibold text-white">{formatLatency(snapshot.services.database.latencyMs)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Active Connections</span>
                            <span className="font-semibold text-white">{dbActiveConnections}</span>
                        </div>
                        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 mt-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-mono mb-1">Detail</p>
                            <p className="text-xs text-slate-300 leading-snug">{snapshot.services.database.detail}</p>
                        </div>
                    </div>
                </article>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <article className="xl:col-span-2 rounded-xl border border-slate-700/80 bg-slate-950/60">
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                        <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-400">Camera Network Status</h2>
                        <div className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">
                            Online: {snapshot.cameraStats.online} • Offline: {snapshot.cameraStats.offline} • Degraded: {snapshot.cameraStats.degraded}
                        </div>
                    </div>
                    <div className="grid grid-cols-[1.3fr_1.7fr_0.7fr_0.8fr_0.8fr_0.8fr] px-5 py-2 text-[10px] uppercase tracking-[0.18em] font-mono text-slate-500 border-b border-slate-800">
                        <span>Camera ID</span>
                        <span>Location</span>
                        <span>FPS</span>
                        <span>Latency</span>
                        <span>Status</span>
                        <span className="text-right">Action</span>
                    </div>
                    <div
                        className="relative overflow-auto"
                        style={{ height: `${TABLE_VIEWPORT_HEIGHT}px` }}
                        onScroll={(event) => setCameraTableScroll(event.currentTarget.scrollTop)}
                    >
                        <div style={{ height: `${visibleWindow.totalHeight}px`, position: 'relative' }}>
                            <div style={{ transform: `translateY(${visibleWindow.offsetTop}px)` }}>
                                {visibleWindow.rows.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid grid-cols-[1.3fr_1.7fr_0.7fr_0.8fr_0.8fr_0.8fr] px-5 items-center border-b border-slate-900/80 text-xs"
                                        style={{ height: `${ROW_HEIGHT}px` }}
                                    >
                                        <span className="font-mono text-slate-200 truncate">{row.id}</span>
                                        <span className="text-slate-300 truncate">{row.location}</span>
                                        <span className="text-slate-200">{row.fps !== null ? row.fps.toFixed(1) : 'N/A'}</span>
                                        <span className="text-slate-200">{formatLatency(row.latencyMs)}</span>
                                        <span>{statusPill(row.status)}</span>
                                        <span className="text-right">
                                            <Link
                                                className="inline-flex items-center gap-1 text-primary hover:text-white transition-colors"
                                                to={`/cameras/${row.id}`}
                                            >
                                                <View className="w-3.5 h-3.5" />
                                                View
                                            </Link>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </article>

                <article className="rounded-xl border border-slate-700/80 bg-slate-950/60">
                    <div className="px-5 py-4 border-b border-slate-800">
                        <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-400">System Health Timeline</h2>
                    </div>
                    <div className="p-4 space-y-3 max-h-[420px] overflow-auto">
                        {incidents.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-3 py-4 text-xs text-slate-500 font-mono uppercase tracking-wider">
                                No incidents captured in this session.
                            </div>
                        ) : (
                            incidents.map((incident) => (
                                <div key={incident.id} className={`rounded-lg border px-3 py-3 ${severityClassMap[incident.severity]}`}>
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em]">{incident.source}</p>
                                        <p className="text-[10px] font-mono uppercase tracking-[0.14em]">{incident.severity}</p>
                                    </div>
                                    <p className="text-sm leading-snug">{incident.message}</p>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.14em] mt-2 opacity-80 inline-flex items-center gap-1">
                                        <Timer className="w-3 h-3" />
                                        {formatClock(incident.timestamp)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </article>
            </section>

            <section className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4 flex items-center gap-3 text-xs text-slate-300">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                    Queue metrics currently reflect authenticated operator scope when global queue telemetry is unavailable.
                </span>
            </section>
        </div>
    );
};
