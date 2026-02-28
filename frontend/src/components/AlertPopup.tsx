import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Bell, ShieldAlert, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface AlertPopupProps {
    alert: any;
    onClose: () => void;
    onAcknowledge: (id: string) => void;
}

export const AlertPopup: React.FC<AlertPopupProps> = ({ alert, onClose, onAcknowledge }) => {
    const [timeLeft, setTimeLeft] = useState(10);

    useEffect(() => {
        // Play alert sound if critical
        if (alert.alertType === 'CRITICAL') {
            const audio = new Audio('/alert.mp3');
            audio.play().catch(e => console.log("Audio play failed, user interaction may be required"));
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [alert]);

    return (
        <div className={clsx(
            "fixed top-6 right-6 z-[100] w-80 overflow-hidden rounded-lg border-2 shadow-2xl animate-in fade-in slide-in-from-right-10 duration-500",
            alert.alertType === 'CRITICAL' ? "border-alert bg-alert/10" : "border-warning bg-warning/10"
        )}>
            {/* Flash Background Effect */}
            <div className={clsx(
                "absolute inset-0 opacity-10",
                alert.alertType === 'CRITICAL' ? "bg-alert animate-pulse" : "bg-warning animate-pulse"
            )}></div>

            <div className="relative p-4 glass-dark">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        {alert.alertType === 'CRITICAL' ? (
                            <ShieldAlert className="text-alert w-6 h-6 animate-bounce" />
                        ) : (
                            <AlertTriangle className="text-warning w-6 h-6" />
                        )}
                        <span className={clsx(
                            "font-display font-black uppercase text-sm tracking-widest",
                            alert.alertType === 'CRITICAL' ? "text-alert" : "text-warning"
                        )}>
                            {alert.alertType} ALERT
                        </span>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-2 mb-4 font-mono text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-400">PLATE:</span>
                        <span className="text-white font-bold">{alert.plateNumber}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-400">VIOLATION:</span>
                        <span className="text-white">{alert.type?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-400">CAMERA:</span>
                        <span className="text-white">{alert.cameraId}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => onAcknowledge(alert.id)}
                        className={clsx(
                            "flex-1 py-2 rounded text-[10px] font-bold uppercase transition-all hover:scale-105 active:scale-95",
                            alert.alertType === 'CRITICAL' ? "bg-alert text-white shadow-neon-alert" : "bg-warning text-background-dark shadow-neon-warning"
                        )}
                    >
                        Acknowledge
                    </button>
                </div>

                {/* Autoclose Progress Bar */}
                <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full overflow-hidden">
                    <div
                        className="h-full bg-white/40 transition-all duration-1000 linear"
                        style={{ width: `${(timeLeft / 10) * 100}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};
