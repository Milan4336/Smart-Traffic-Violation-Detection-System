import React from 'react';
import { Badge } from '../ui/Badge';
import { Car } from 'lucide-react';
import { clsx } from 'clsx';

export interface ViolationCardProps {
    plate: string;
    type: string;
    confidence: number;
    time: string;
    cameraId: string;
    status?: 'verified' | 'rejected' | 'pending';
    fineAmount?: number | null;
    fineStatus?: string | null;
    vehicle?: {
        totalViolations: number;
        riskLevel: string;
    } | null;
    onClick?: () => void;
    onPlateClick?: () => void;
}

export const ViolationCard: React.FC<ViolationCardProps> = ({
    plate, type, confidence, status = 'pending', vehicle, fineAmount, fineStatus, onClick, onPlateClick
}) => {
    const isRepeatOffender = vehicle && vehicle.totalViolations >= 3;


    return (
        <div
            onClick={onClick}
            className={clsx(
                "flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 hover:border-primary/30 transition-colors cursor-pointer group",
                status === 'pending' && "border-l-2 border-l-alert/50"
            )}
        >
            <div className="flex items-center gap-3">
                <div className="size-8 rounded bg-slate-800 flex items-center justify-center border border-slate-700">
                    <Car className="text-white w-4 h-4" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span
                            className="text-xs font-mono text-primary hover:text-white hover:underline cursor-pointer"
                            onClick={(e) => {
                                if (onPlateClick) {
                                    e.stopPropagation();
                                    onPlateClick();
                                }
                            }}
                        >
                            {plate}
                        </span>
                        {isRepeatOffender && (
                            <span className="text-[8px] font-bold bg-alert/20 text-alert px-1 border border-alert/30 rounded animate-pulse">
                                REPEAT OFFENDER
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase">
                        {type} • {confidence}%
                        {vehicle && ` • RISK: ${vehicle.riskLevel}`}
                    </span>
                    {fineAmount && (
                        <span className={clsx(
                            "text-[10px] font-bold mt-0.5",
                            fineStatus === 'paid' ? "text-success" : "text-warning"
                        )}>
                            ₹{fineAmount.toLocaleString()} • {fineStatus?.toUpperCase()}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {status === 'verified' && <Badge variant="success">VERIFIED</Badge>}
                {status === 'rejected' && <Badge variant="default">REJECTED</Badge>}
                {status === 'pending' && <Badge variant="alert">NEW</Badge>}
            </div>
        </div>
    );
};
