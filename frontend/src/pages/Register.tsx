import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const Register: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role: 'officer', clearanceLevel: 2 })
            });
            const data = await res.json();

            if (res.ok) {
                alert("Clearance granted. Please initialize uplink.");
                navigate('/auth/login');
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            setError('System connection error');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background-dark text-white p-4">
            <div className="max-w-md w-full glass-panel p-8 rounded-lg relative overflow-hidden scanline-effect border border-primary/20 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                <div className="flex flex-col items-center mb-8">
                    <div className="size-16 rounded-full border border-primary flex items-center justify-center mb-4 bg-primary/10 shadow-[0_0_15px_rgba(0,255,163,0.3)]">
                        <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-display font-bold tracking-widest text-center mt-2">NEW CLEARANCE</h2>
                </div>

                {error && (
                    <div className="border border-alert bg-alert/10 text-alert p-3 mb-6 rounded text-sm font-mono text-center animate-pulse">
                        ERROR: {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5 font-mono">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">OPERATIVE ALIAS</label>
                        <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">EMAIL</label>
                        <input
                            type="email"
                            className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">NEW PASSCODE</label>
                        <input
                            type="password"
                            className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 mt-4 border border-primary text-primary font-bold hover:bg-primary hover:text-black transition-all tracking-widest"
                    >
                        REQUEST CLEARANCE
                    </button>
                    <div className="text-center mt-4">
                        <span className="text-xs text-slate-500 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/auth/login')}>CANCEL</span>
                    </div>
                </form>
            </div>
        </div>
    );
};
