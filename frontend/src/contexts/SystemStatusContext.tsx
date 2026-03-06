import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { socket } from '../socket';

export type HealthState = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'STARTING';
export type IncidentSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface ServiceHealth {
    status: HealthState;
    lastCheck: string;
    latencyMs: number | null;
    metricLabel?: string;
    metricValue?: string;
    detail: string;
}

export interface CameraStatusRow {
    id: string;
    name: string;
    location: string;
    fps: number | null;
    latencyMs: number | null;
    status: HealthState;
}

export interface QueueMetrics {
    pendingJobs: number;
    processingJobs: number;
    failedJobs: number;
    averageProcessingTimeMs: number | null;
}

export interface AiModelStatus {
    modelVersion: string;
    modelLoaded: boolean;
    gpuUsagePercent: number | null;
    inferenceLatencyMs: number | null;
    activeAiJobs: number;
    ocrEnabled: boolean | null;
}

export interface SystemIncident {
    id: string;
    timestamp: string;
    severity: IncidentSeverity;
    source: string;
    message: string;
}

export interface SystemStatusSnapshot {
    lastUpdated: string;
    currentVersion: string;
    activeAlerts: number;
    metrics: Record<string, number>;
    services: {
        system: ServiceHealth;
        api: ServiceHealth;
        ai: ServiceHealth;
        cameras: ServiceHealth;
        database: ServiceHealth;
        redis: ServiceHealth;
        storage: ServiceHealth;
    };
    cameraRows: CameraStatusRow[];
    cameraStats: {
        online: number;
        offline: number;
        degraded: number;
    };
    queue: QueueMetrics;
    aiModel: AiModelStatus;
}

interface SystemStatusContextType {
    snapshot: SystemStatusSnapshot;
    incidents: SystemIncident[];
    loading: boolean;
    refresh: () => Promise<void>;
}

interface TimedResult<T> {
    ok: boolean;
    data: T | null;
    latencyMs: number | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = API_URL.replace(/\/api\/?$/, '');

const buildService = (
    status: HealthState,
    checkTime: string,
    latencyMs: number | null,
    detail: string,
    metricLabel?: string,
    metricValue?: string
): ServiceHealth => ({
    status,
    lastCheck: checkTime,
    latencyMs,
    detail,
    metricLabel,
    metricValue
});

const initialCheckTime = new Date(0).toISOString();
const initialService = buildService('STARTING', initialCheckTime, null, 'Awaiting first telemetry pull');

const initialSnapshot: SystemStatusSnapshot = {
    lastUpdated: initialCheckTime,
    currentVersion: 'v1.0.0',
    activeAlerts: 0,
    metrics: {},
    services: {
        system: initialService,
        api: initialService,
        ai: initialService,
        cameras: initialService,
        database: initialService,
        redis: initialService,
        storage: initialService
    },
    cameraRows: [],
    cameraStats: {
        online: 0,
        offline: 0,
        degraded: 0
    },
    queue: {
        pendingJobs: 0,
        processingJobs: 0,
        failedJobs: 0,
        averageProcessingTimeMs: null
    },
    aiModel: {
        modelVersion: 'YOLOv8 Traffic Model',
        modelLoaded: false,
        gpuUsagePercent: null,
        inferenceLatencyMs: null,
        activeAiJobs: 0,
        ocrEnabled: null
    }
};

const healthPriority: Record<HealthState, number> = {
    HEALTHY: 0,
    STARTING: 1,
    DEGRADED: 2,
    OFFLINE: 3
};

const worstStatus = (...states: HealthState[]): HealthState => {
    return states.reduce((worst, current) =>
        healthPriority[current] > healthPriority[worst] ? current : worst,
    'HEALTHY');
};

const toCameraLocation = (camera: Record<string, unknown>): string => {
    const lat = typeof camera.locationLat === 'number' ? camera.locationLat : null;
    const lng = typeof camera.locationLng === 'number' ? camera.locationLng : null;
    if (lat === null || lng === null) return 'Unknown';
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

const createIncidentId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const parsePayload = (payload: unknown): Record<string, unknown> => {
    if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
    if (typeof payload === 'string') {
        try {
            return JSON.parse(payload) as Record<string, unknown>;
        } catch {
            return { message: payload };
        }
    }
    return {};
};

const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
};

const timedJson = async <T,>(url: string, options?: RequestInit): Promise<TimedResult<T>> => {
    const startedAt = performance.now();
    try {
        const response = await fetch(url, options);
        const endedAt = performance.now();
        const latencyMs = Math.round(endedAt - startedAt);
        if (!response.ok) {
            return { ok: false, data: null, latencyMs };
        }
        const data = (await response.json()) as T;
        return {
            ok: true,
            data,
            latencyMs
        };
    } catch {
        return {
            ok: false,
            data: null,
            latencyMs: null
        };
    }
};

const readStorageHealth = async (): Promise<{ status: HealthState; metricValue: string; detail: string }> => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
        return {
            status: 'STARTING',
            metricValue: 'N/A',
            detail: 'Browser storage metrics unavailable'
        };
    }

    try {
        const estimate = await navigator.storage.estimate();
        if (!estimate.quota || estimate.quota <= 0) {
            return {
                status: 'STARTING',
                metricValue: 'N/A',
                detail: 'Storage quota unavailable'
            };
        }

        const usage = estimate.usage || 0;
        const usagePct = (usage / estimate.quota) * 100;
        const usedGb = (usage / 1024 / 1024 / 1024).toFixed(2);
        const quotaGb = (estimate.quota / 1024 / 1024 / 1024).toFixed(2);
        const status: HealthState = usagePct >= 90 ? 'DEGRADED' : 'HEALTHY';

        return {
            status,
            metricValue: `${usedGb} GB / ${quotaGb} GB`,
            detail: `${usagePct.toFixed(1)}% client-side cache utilization`
        };
    } catch {
        return {
            status: 'DEGRADED',
            metricValue: 'N/A',
            detail: 'Failed to estimate client storage usage'
        };
    }
};

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined);

export const SystemStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [snapshot, setSnapshot] = useState<SystemStatusSnapshot>(initialSnapshot);
    const [incidents, setIncidents] = useState<SystemIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const refreshTimerRef = useRef<number | null>(null);

    const addIncident = useCallback((source: string, message: string, severity: IncidentSeverity) => {
        const incident: SystemIncident = {
            id: createIncidentId(),
            timestamp: new Date().toISOString(),
            severity,
            source,
            message
        };

        setIncidents((previous) => [incident, ...previous].slice(0, 40));
    }, []);

    const refresh = useCallback(async () => {
        const authHeaders = getAuthHeaders();
        const checkTime = new Date().toISOString();

        const [
            backendHealth,
            metricsResponse,
            camerasResponse,
            alertsResponse,
            videosResponse,
            versionResponse,
            storageHealth
        ] = await Promise.all([
            timedJson<{ status?: string; service?: string }>(`${API_BASE_URL}/health`),
            timedJson<Record<string, number>>(`${API_URL}/system/metrics`, { headers: authHeaders }),
            timedJson<Array<Record<string, unknown>>>(`${API_URL}/cameras`, { headers: authHeaders }),
            timedJson<Array<Record<string, unknown>>>(`${API_URL}/alerts`, { headers: authHeaders }),
            timedJson<Array<Record<string, unknown>>>(`${API_URL}/videos`, { headers: authHeaders }),
            timedJson<{ currentVersion?: string }>(`${API_URL}/system/version/latest`, { headers: authHeaders }),
            readStorageHealth()
        ]);

        const metrics = metricsResponse.data && typeof metricsResponse.data === 'object' ? metricsResponse.data : {};
        const activeAlerts = Array.isArray(alertsResponse.data)
            ? alertsResponse.data.length
            : (metrics.critical_alerts || 0);

        const cameraRows: CameraStatusRow[] = Array.isArray(camerasResponse.data)
            ? camerasResponse.data.map((camera) => {
                const adminStatus = typeof camera.status === 'string' ? camera.status : '';
                const healthStatus = typeof camera.healthStatus === 'string' ? camera.healthStatus : '';
                let mergedStatus: HealthState = 'STARTING';
                if (adminStatus.toUpperCase().includes('OFFLINE') || healthStatus.toUpperCase().includes('OFFLINE')) {
                    mergedStatus = 'OFFLINE';
                } else if (healthStatus.toUpperCase().includes('DEGRADED')) {
                    mergedStatus = 'DEGRADED';
                } else if (adminStatus.toUpperCase().includes('ONLINE') || healthStatus.toUpperCase().includes('HEALTHY')) {
                    mergedStatus = 'HEALTHY';
                }
                return {
                    id: String(camera.id || ''),
                    name: String(camera.name || 'Unnamed Camera'),
                    location: toCameraLocation(camera),
                    fps: typeof camera.currentFps === 'number' ? camera.currentFps : null,
                    latencyMs: typeof camera.latencyMs === 'number' ? camera.latencyMs : null,
                    status: mergedStatus
                };
            })
            : [];

        const cameraStats = cameraRows.reduce(
            (acc, row) => {
                if (row.status === 'HEALTHY') acc.online += 1;
                if (row.status === 'OFFLINE') acc.offline += 1;
                if (row.status === 'DEGRADED') acc.degraded += 1;
                return acc;
            },
            { online: 0, offline: 0, degraded: 0 }
        );

        const averageCameraLatency = cameraRows
            .map((camera) => camera.latencyMs)
            .filter((value): value is number => typeof value === 'number')
            .reduce((total, value, _, collection) => total + value / collection.length, 0);
        const normalizedCameraLatency = Number.isFinite(averageCameraLatency) && averageCameraLatency > 0
            ? Math.round(averageCameraLatency)
            : null;

        const queue = (Array.isArray(videosResponse.data) ? videosResponse.data : []).reduce<QueueMetrics>((acc, item) => {
            const status = String(item.status || '').toLowerCase();
            if (status === 'queued') acc.pendingJobs += 1;
            if (status === 'processing') acc.processingJobs += 1;
            if (status === 'failed') acc.failedJobs += 1;
            return acc;
        }, {
            pendingJobs: 0,
            processingJobs: 0,
            failedJobs: 0,
            averageProcessingTimeMs: null
        });

        if (Array.isArray(videosResponse.data)) {
            const completedDurations = videosResponse.data
                .filter((item) => String(item.status || '').toLowerCase() === 'completed')
                .map((item) => Number(item.durationSeconds))
                .filter((value) => Number.isFinite(value) && value > 0);

            if (completedDurations.length > 0) {
                const avgSeconds = completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length;
                queue.averageProcessingTimeMs = Math.round(avgSeconds * 1000);
            }
        }

        const apiStatus: HealthState = !backendHealth.ok
            ? 'OFFLINE'
            : (backendHealth.latencyMs !== null && backendHealth.latencyMs > 1200 ? 'DEGRADED' : 'HEALTHY');

        const camerasStatus: HealthState = !camerasResponse.ok
            ? 'OFFLINE'
            : cameraRows.length === 0
                ? 'STARTING'
                : cameraStats.online === 0
                    ? 'OFFLINE'
                    : (cameraStats.offline > 0 || cameraStats.degraded > 0 ? 'DEGRADED' : 'HEALTHY');

        const databaseQueryLatency = (() => {
            const values = [metricsResponse.latencyMs, camerasResponse.latencyMs].filter((value): value is number => value !== null);
            if (values.length === 0) return null;
            return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
        })();

        const databaseStatus: HealthState = (!metricsResponse.ok && !camerasResponse.ok)
            ? 'OFFLINE'
            : (databaseQueryLatency !== null && databaseQueryLatency > 1000)
                ? 'DEGRADED'
                : ((!metricsResponse.ok || !camerasResponse.ok) ? 'DEGRADED' : 'HEALTHY');

        const redisStatus: HealthState = apiStatus === 'OFFLINE'
            ? 'OFFLINE'
            : (!socket.connected || queue.failedJobs > 0 || queue.pendingJobs > 50 ? 'DEGRADED' : 'HEALTHY');

        const aiStatus: HealthState = apiStatus === 'OFFLINE'
            ? 'OFFLINE'
            : (cameraStats.online > 0)
                ? ((normalizedCameraLatency !== null && normalizedCameraLatency > 650) ? 'DEGRADED' : 'HEALTHY')
                : ((queue.processingJobs > 0 || queue.pendingJobs > 0) ? 'STARTING' : 'DEGRADED');

        const systemStatus = worstStatus(
            apiStatus,
            aiStatus,
            camerasStatus,
            databaseStatus,
            redisStatus,
            storageHealth.status
        );

        const nextSnapshot: SystemStatusSnapshot = {
            lastUpdated: checkTime,
            currentVersion: versionResponse.data?.currentVersion || initialSnapshot.currentVersion,
            activeAlerts,
            metrics,
            services: {
                system: buildService(
                    systemStatus,
                    checkTime,
                    null,
                    'Consolidated posture across API, AI, camera network, datastore, and queues',
                    'Critical Alerts',
                    String(activeAlerts)
                ),
                api: buildService(
                    apiStatus,
                    checkTime,
                    backendHealth.latencyMs,
                    backendHealth.ok ? 'Backend REST gateway reachable' : 'Backend gateway unreachable',
                    'Response Time',
                    backendHealth.latencyMs !== null ? `${backendHealth.latencyMs} ms` : 'N/A'
                ),
                ai: buildService(
                    aiStatus,
                    checkTime,
                    normalizedCameraLatency,
                    cameraStats.online > 0
                        ? 'Inference telemetry available from active camera heartbeats'
                        : 'No active inference stream heartbeat',
                    'Active AI Jobs',
                    String(queue.processingJobs + cameraStats.online)
                ),
                cameras: buildService(
                    camerasStatus,
                    checkTime,
                    normalizedCameraLatency,
                    `${cameraStats.online} online / ${cameraStats.offline} offline / ${cameraStats.degraded} degraded`,
                    'Avg Stream Latency',
                    normalizedCameraLatency !== null ? `${normalizedCameraLatency} ms` : 'N/A'
                ),
                database: buildService(
                    databaseStatus,
                    checkTime,
                    databaseQueryLatency,
                    metricsResponse.ok && camerasResponse.ok
                        ? 'Operational queries returned valid payloads'
                        : 'One or more DB-backed telemetry calls failed',
                    'Query Latency',
                    databaseQueryLatency !== null ? `${databaseQueryLatency} ms` : 'N/A'
                ),
                redis: buildService(
                    redisStatus,
                    checkTime,
                    null,
                    socket.connected ? 'Socket channel linked to live event bus' : 'Socket channel disconnected from event bus',
                    'Queue Backlog',
                    `${queue.pendingJobs + queue.processingJobs}`
                ),
                storage: buildService(
                    storageHealth.status,
                    checkTime,
                    null,
                    storageHealth.detail,
                    'Usage',
                    storageHealth.metricValue
                )
            },
            cameraRows,
            cameraStats,
            queue,
            aiModel: {
                modelVersion: 'YOLOv8 Traffic Model',
                modelLoaded: aiStatus !== 'OFFLINE',
                gpuUsagePercent: null,
                inferenceLatencyMs: normalizedCameraLatency,
                activeAiJobs: queue.processingJobs + cameraStats.online,
                ocrEnabled: null
            }
        };

        setSnapshot((previous) => {
            if (previous.lastUpdated !== initialCheckTime) {
                const transitions: Array<{ key: string; next: HealthState; previous: HealthState }> = [
                    { key: 'System', previous: previous.services.system.status, next: nextSnapshot.services.system.status },
                    { key: 'API', previous: previous.services.api.status, next: nextSnapshot.services.api.status },
                    { key: 'AI', previous: previous.services.ai.status, next: nextSnapshot.services.ai.status },
                    { key: 'Cameras', previous: previous.services.cameras.status, next: nextSnapshot.services.cameras.status },
                    { key: 'Database', previous: previous.services.database.status, next: nextSnapshot.services.database.status },
                    { key: 'Redis', previous: previous.services.redis.status, next: nextSnapshot.services.redis.status }
                ];

                transitions
                    .filter((item) => item.previous !== item.next)
                    .forEach((item) => {
                        const severity: IncidentSeverity = item.next === 'OFFLINE'
                            ? 'CRITICAL'
                            : (item.next === 'DEGRADED' ? 'WARN' : 'INFO');
                        addIncident(item.key, `${item.key} moved to ${item.next}`, severity);
                    });
            }
            return nextSnapshot;
        });

        setLoading(false);
    }, [addIncident]);

    const scheduleRefresh = useCallback((delayMs: number = 300) => {
        if (refreshTimerRef.current !== null) {
            window.clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = window.setTimeout(() => {
            void refresh();
            refreshTimerRef.current = null;
        }, delayMs);
    }, [refresh]);

    useEffect(() => {
        void refresh();
        const interval = window.setInterval(() => {
            void refresh();
        }, 15000);

        const handleCameraOffline = (payload: unknown) => {
            const parsed = parsePayload(payload);
            const cameraName = String(parsed.name || parsed.id || 'camera');
            addIncident('Camera', `${cameraName} reported OFFLINE`, 'CRITICAL');
            scheduleRefresh();
        };

        const handleCameraDegraded = (payload: unknown) => {
            const parsed = parsePayload(payload);
            const cameraName = String(parsed.name || parsed.id || 'camera');
            addIncident('Camera', `${cameraName} entered DEGRADED mode`, 'WARN');
            scheduleRefresh();
        };

        const handleCameraRecovered = (payload: unknown) => {
            const parsed = parsePayload(payload);
            const cameraName = String(parsed.name || parsed.id || 'camera');
            addIncident('Camera', `${cameraName} recovered to HEALTHY`, 'INFO');
            scheduleRefresh();
        };

        const handleSystemHealthUpdate = (payload: unknown) => {
            const parsed = parsePayload(payload);
            const nextState = String(parsed.status || 'updated').toUpperCase();
            addIncident('System', `Health broadcast received: ${nextState}`, nextState === 'OFFLINE' ? 'CRITICAL' : 'INFO');
            scheduleRefresh(120);
        };

        const handleAiModelLoaded = (payload: unknown) => {
            const parsed = parsePayload(payload);
            const model = String(parsed.modelVersion || parsed.model || 'YOLO model');
            addIncident('AI', `${model} reported as loaded`, 'INFO');
            scheduleRefresh(120);
        };

        const handleAlertNew = (payload: unknown) => {
            const parsed = parsePayload(payload);
            const plate = String(parsed.plateNumber || 'Unknown plate');
            const alertType = String(parsed.alertType || 'ALERT').toUpperCase();
            addIncident('Alert', `${alertType} alert for ${plate}`, alertType === 'CRITICAL' ? 'CRITICAL' : 'WARN');
            scheduleRefresh(120);
        };

        const handleSocketDisconnect = () => {
            addIncident('Redis', 'Socket transport disconnected from event stream', 'WARN');
            scheduleRefresh(200);
        };

        socket.on('metrics:update', () => scheduleRefresh(160));
        socket.on('camera:offline', handleCameraOffline);
        socket.on('camera:degraded', handleCameraDegraded);
        socket.on('camera:recovered', handleCameraRecovered);
        socket.on('alert:new', handleAlertNew);
        socket.on('system:health_update', handleSystemHealthUpdate);
        socket.on('ai:model_loaded', handleAiModelLoaded);
        socket.on('disconnect', handleSocketDisconnect);
        socket.on('connect', () => scheduleRefresh(120));

        return () => {
            window.clearInterval(interval);
            if (refreshTimerRef.current !== null) {
                window.clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
            socket.off('metrics:update');
            socket.off('camera:offline', handleCameraOffline);
            socket.off('camera:degraded', handleCameraDegraded);
            socket.off('camera:recovered', handleCameraRecovered);
            socket.off('alert:new', handleAlertNew);
            socket.off('system:health_update', handleSystemHealthUpdate);
            socket.off('ai:model_loaded', handleAiModelLoaded);
            socket.off('disconnect', handleSocketDisconnect);
            socket.off('connect');
        };
    }, [addIncident, refresh, scheduleRefresh]);

    const contextValue = useMemo<SystemStatusContextType>(() => ({
        snapshot,
        incidents,
        loading,
        refresh
    }), [snapshot, incidents, loading, refresh]);

    return (
        <SystemStatusContext.Provider value={contextValue}>
            {children}
        </SystemStatusContext.Provider>
    );
};

export const useSystemStatus = (): SystemStatusContextType => {
    const context = useContext(SystemStatusContext);
    if (!context) {
        throw new Error('useSystemStatus must be used inside SystemStatusProvider');
    }
    return context;
};
