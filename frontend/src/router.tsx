import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Updates } from './pages/Updates';
import { AdminUpdates } from './pages/AdminUpdates';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Grid } from './pages/Grid';
import { Logs } from './pages/Logs';
import { Stats } from './pages/Stats';
import { VideoUpload } from './pages/VideoUpload';
import { VideoDetails } from './pages/VideoDetails';
import { VehicleProfile } from './pages/VehicleProfile';

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
                        element: <Updates />,
                    },
                    {
                        path: 'vehicles/:plateNumber',
                        element: <VehicleProfile />,
                    },
                    {
                        path: 'admin/system-updates',
                        element: <AdminUpdates />,
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
