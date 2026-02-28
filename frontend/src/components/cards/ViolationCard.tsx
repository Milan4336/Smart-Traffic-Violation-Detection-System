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
    onClick?: () => void;
}

export const ViolationCard: React.FC<ViolationCardProps> = ({
    plate, type, confidence, time, cameraId, status = 'pending', onClick
}) => {
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
                    <span className="text-xs font-mono text-primary group-hover:text-white">{plate}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{type} • {confidence}%</span>
                </div>
            </div>

            {status === 'verified' && <Badge variant="success">VERIFIED</Badge>}
            {status === 'rejected' && <Badge variant="default">REJECTED</Badge>}
            {status === 'pending' && <Badge variant="alert">NEW</Badge>}
        </div>
    );
};
