import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { SystemUpdates } from './pages/SystemUpdates';
import { AdminUpdates } from './pages/AdminUpdates';
import { AdminBlacklist } from './pages/AdminBlacklist';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Grid } from './pages/Grid';
import { Logs } from './pages/Logs';
import { Stats } from './pages/Stats';
import { VideoUpload } from './pages/VideoUpload';
import { VideoDetails } from './pages/VideoDetails';
import { VehicleProfile } from './pages/VehicleProfile';
import { CameraViewer } from './pages/CameraViewer';
import { CameraDirectory } from './pages/CameraDirectory';
import { CameraGrid } from './pages/CameraGrid';
import { AdminUsers } from './pages/AdminUsers';
import { ReviewQueue } from './pages/ReviewQueue';
import { SystemStatus } from './pages/SystemStatus';

export const router = createBrowserRouter([
    {
        path: '/auth/login',
        element: <Login />,
    },
    {
        path: '/auth/register',
        element: <Register />,
    },
    {
        path: '/',
        element: <ProtectedRoute />,
        children: [
            {
                path: '/',
                element: <MainLayout />,
                children: [
                    {
                        index: true,
                        element: <Dashboard />,
                    },
                    {
                        path: 'live-monitoring',
                        element: <Grid />,
                    },
                    {
                        path: 'violations',
                        element: <Logs />,
                    },
                    {
                        path: 'cameras',
                        element: <CameraDirectory />,
                    },
                    {
                        path: 'cameras/:id',
                        element: <CameraViewer />,
                    },
                    {
                        path: 'cameras/grid',
                        element: <CameraGrid />,
                    },
                    {
                        path: 'analytics',
                        element: <Stats />,
                    },
                    {
                        path: 'videos',
                        element: <VideoUpload />,
                    },
                    {
                        path: 'videos/:id',
                        element: <VideoDetails />,
                    },
                    {
                        path: 'system',
                        element: <SystemUpdates />,
                    },
                    {
                        path: 'system-updates',
                        element: <SystemUpdates />,
                    },
                    {
                        path: 'system-status',
                        element: <SystemStatus />,
                    },
                    {
                        path: 'vehicles/:plateNumber',
                        element: <VehicleProfile />,
                    },
                    {
                        path: 'admin/system-updates',
                        element: <AdminUpdates />,
                    },
                    {
                        path: 'admin/blacklist',
                        element: <AdminBlacklist />,
                    },
                    {
                        path: 'admin/users',
                        element: <AdminUsers />,
                    },
                    {
                        path: 'violations/review',
                        element: <ReviewQueue />,
                    }
                ]
            }
        ],
    },
    {
        path: '*',
        element: <Navigate to="/" replace />
    }
]);
