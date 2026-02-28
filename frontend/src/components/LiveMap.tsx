import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, AlertCircle } from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface MapProps {
    cameras: any[];
    violations: any[];
}

const customIcon = (iconNode: React.ReactNode, type: 'camera' | 'violation', health?: string) => {
    let healthColor = 'bg-primary'; // Default for violations etc
    let pingColor = 'bg-primary opacity-20';
    let borderColor = 'border-white';
    let pulseClass = 'animate-ping';

    if (type === 'camera') {
        if (health === 'DEGRADED') {
            healthColor = 'bg-warning shadow-neon-warning';
            pingColor = 'bg-warning opacity-30';
            pulseClass = ''; // No ping for degraded, just static warning
        } else if (health === 'OFFLINE') {
            healthColor = 'bg-alert shadow-neon-alert';
            pingColor = 'bg-alert opacity-40';
            pulseClass = 'animate-pulse';
        } else {
            healthColor = 'bg-success shadow-neon-success';
            pingColor = 'bg-success opacity-20';
        }
    } else {
        healthColor = 'bg-alert shadow-neon-alert';
        pingColor = 'bg-alert opacity-40';
    }

    return new L.DivIcon({
        className: 'bg-transparent border-none',
        html: `<div class="relative flex items-center justify-center pointer-events-none">
                <span class="${pulseClass} absolute inline-flex h-full w-full rounded-full ${pingColor} ${type === 'violation' ? 'size-12' : 'size-8'}"></span>
                <div class="relative flex items-center justify-center rounded-full ${type === 'violation' ? 'size-6' : 'size-5'} ${healthColor} border-2 ${borderColor} text-background-dark">
                    ${renderToString(iconNode)}
                </div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

const MapController: React.FC<{ center: [number, number] }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center[0] && center[1]) {
            map.flyTo(center, 13, { duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

export const LiveMap: React.FC<MapProps> = ({ cameras, violations }) => {
    // Default center to New Delhi as per dummy data if no cameras exist
    const defaultCenter: [number, number] = [28.6139, 77.2090];
    const center = cameras.length > 0 && cameras[0].locationLat ? [cameras[0].locationLat, cameras[0].locationLng] as [number, number] : defaultCenter;

    return (
        <MapContainer center={center} zoom={13} className="w-full h-full" zoomControl={false} attributionControl={false}>
            {/* Dark/Cyberpunk Basemap tile layer */}
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; <a href='https://carto.com/'>CARTO</a>"
            />
            {cameras.map(cam => (
                <Marker
                    key={cam.id}
                    position={[cam.locationLat, cam.locationLng]}
                    icon={customIcon(<Camera size={12} strokeWidth={3} />, 'camera', cam.healthStatus)}
                >
                    <Popup className="cyber-popup">
                        <div className="font-mono text-xs p-1">
                            <div className="text-primary font-bold mb-1">{cam.name}</div>
                            <div className="text-slate-400">STATUS: {cam.status}</div>
                        </div>
                    </Popup>
                </Marker>
            ))}

            {violations.map(violation => {
                if (!violation.locationLat || !violation.locationLng) return null;
                return (
                    <Marker
                        key={violation.id}
                        position={[violation.locationLat, violation.locationLng]}
                        icon={customIcon(<AlertCircle size={14} strokeWidth={3} className="text-white" />, 'violation')}
                    >
                        <Popup className="cyber-popup alert">
                            <div className="font-mono text-xs p-1">
                                <div className="text-alert font-bold mb-1">{violation.type.replace('_', ' ')}</div>
                                <div className="text-slate-400">CAMERA: {violation.cameraId}</div>
                                <div className="text-slate-400 mt-1">CONF: {violation.confidenceScore}%</div>
                            </div>
                        </Popup>
                    </Marker>
                )
            })}
            <MapController center={center} />
        </MapContainer>
    );
};
