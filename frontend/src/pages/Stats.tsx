import React, { useEffect, useState } from 'react';
import { LineChart, Activity, ShieldAlert, Cpu, Database } from 'lucide-react';
import { AnalyticsCard } from './Dashboard';

export const Stats: React.FC = () => {
    const [analytics, setAnalytics] = useState({ totalViolations: 0, todayViolations: 0, activeCameras: 0, avgConfidence: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

            try {
                const res = await fetch(`${apiUrl}/analytics`, { headers });
                if (res.ok) {
                    setAnalytics(await res.json());
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="h-full flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                    <h2 className="font-display font-bold text-2xl text-white uppercase tracking-widest flex items-center gap-3">
                        <LineChart className="text-primary w-6 h-6" /> ANALYTICS MATRIX
                    </h2>
                    <p className="text-slate-400 font-mono text-sm mt-1">Aggregated operational metrics from all active AI nodes.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <AnalyticsCard
                    title="Total Violations Logged"
                    value={analytics.totalViolations.toLocaleString()}
                    icon={<Database className="w-5 h-5" />}
                    color="primary"
                />
                <AnalyticsCard
                    title="Today's Incidents"
                    value={analytics.todayViolations.toLocaleString()}
                    icon={<ShieldAlert className="w-5 h-5" />}
                    color="alert"
                />
                <AnalyticsCard
                    title="Mean AI Confidence"
                    value={`${analytics.avgConfidence.toFixed(1)}%`}
                    icon={<Cpu className="w-5 h-5" />}
                    color={analytics.avgConfidence > 90 ? "success" : "warning"}
                />
                <AnalyticsCard
                    title="Active Data Nodes"
                    value={analytics.activeCameras}
                    icon={<Activity className="w-5 h-5" />}
                    color="primary"
                />
            </div>

            <div className="flex-1 glass-panel rounded-lg border border-slate-800/50 p-6 flex flex-col min-h-[400px]">
                <h3 className="text-primary font-mono text-sm font-bold mb-6">THREAT DISTRIBUTION (7 DAYS)</h3>

                {/* Mocked structural layout for a Bar Chart */}
                <div className="flex-1 flex gap-4 items-end pb-8 border-b border-primary/20 relative">
                    <div className="absolute top-0 w-full h-px bg-slate-800/50"></div>
                    <div className="absolute top-1/4 w-full h-px bg-slate-800/50"></div>
                    <div className="absolute top-2/4 w-full h-px bg-slate-800/50"></div>
                    <div className="absolute top-3/4 w-full h-px bg-slate-800/50"></div>

                    {[80, 45, 110, 60, 25, 95, 130].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 z-10">
                            <div className="w-full bg-primary/20 hover:bg-primary/40 transition-colors border-t-2 border-primary rounded-t relative group" style={{ height: `${h}px` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-primary font-mono text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    {h}
                                </div>
                            </div>
                            <span className="text-xs font-mono text-slate-500 block absolute -bottom-6">DAY {i + 1}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
