import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface User {
    id: string;
    email?: string;
    name?: string;
    role: string;
    clearanceLevel: number;
}

interface DecodedToken {
    id: string;
    role: string;
    clearanceLevel: number;
    exp?: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, userData: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isOfficer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    });
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            try {
                const decoded = jwtDecode<DecodedToken>(token);
                const exp = decoded.exp;
                if (exp && exp * 1000 < Date.now()) {
                    logout();
                } else if (!user) {
                    setUser({
                        id: decoded.id,
                        role: decoded.role,
                        clearanceLevel: decoded.clearanceLevel
                    });
                }
            } catch (err) {
                console.error("Invalid token", err);
                logout();
            }
        } else {
            setUser(null);
        }
    }, [token, user]);

    const login = (newToken: string, userData: User) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    const isAdmin = user?.role.toUpperCase() === 'ADMIN';
    const isOfficer = user?.role.toUpperCase() === 'OFFICER' || isAdmin;

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            isAuthenticated: !!token,
            isAdmin,
            isOfficer
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
