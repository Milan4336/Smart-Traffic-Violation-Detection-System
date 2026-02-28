import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Updates } from './pages/Updates';
import { AdminUpdates } from './pages/AdminUpdates';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';

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
                        element: <div className="p-6 text-white font-mono text-xl">GRID PAGE (WIP)</div>,
                    },
                    {
                        path: 'violations',
                        element: <div className="p-6 text-white font-mono text-xl">LOGS PAGE (WIP)</div>,
                    },
                    {
                        path: 'analytics',
                        element: <div className="p-6 text-white font-mono text-xl">STATS PAGE (WIP)</div>,
                    },
                    {
                        path: 'system',
                        element: <Updates />,
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
