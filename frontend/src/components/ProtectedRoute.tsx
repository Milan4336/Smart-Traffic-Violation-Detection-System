import React, { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/auth/login', { state: { from: location }, replace: true });
        }
    }, [isAuthenticated, navigate, location]);

    if (!isAuthenticated) return null;

    return <Outlet />;
};
