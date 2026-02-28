import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield } from 'lucide-react';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('admin@neonguardian.com');
    const [password, setPassword] = useState('admin123');
    const [error, setError] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authStep, setAuthStep] = useState(0);
    const { login } = useAuth();
    const navigate = useNavigate();

    const authSteps = [
        "IDLE",
        "ESTABLISHING SECURE UPLINK...",
        "VERIFYING BIOMETRIC SIGNATURES...",
        "DECRYPTING CLEARANCE PROTOCOLS...",
        "ACCESS GRANTED. WELCOME COMMANDER."
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsAuthenticating(true);

        // Sequence Animation
        setAuthStep(1);
        await new Promise(r => setTimeout(r, 600));
        setAuthStep(2);
        await new Promise(r => setTimeout(r, 800));
        setAuthStep(3);
        await new Promise(r => setTimeout(r, 600));

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                setAuthStep(4);
                await new Promise(r => setTimeout(r, 1000));
                login(data.token);
                navigate('/');
            } else {
                setIsAuthenticating(false);
                setAuthStep(0);
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setIsAuthenticating(false);
            setAuthStep(0);
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
                    <h2 className="text-3xl font-display font-bold tracking-widest text-center">NEON <span className="text-primary">GUARDIAN</span></h2>
                    <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mt-2">Level 4 Clearance Required</p>
                </div>

                {error && (
                    <div className="border border-alert bg-alert/10 text-alert p-3 mb-6 rounded text-sm font-mono text-center animate-pulse">
                        ACCESS DENIED: {error}
                    </div>
                )}

                {isAuthenticating ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-6 min-h-[300px]">
                        <div className="relative size-24">
                            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                            <div className="absolute inset-2 border-4 border-success/50 rounded-full border-b-transparent animate-spin-slow reverse"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Shield className={authStep === 4 ? "text-success w-8 h-8 drop-shadow-[0_0_10px_rgba(5,255,161,0.8)]" : "text-primary w-8 h-8 animate-pulse"} />
                            </div>
                        </div>

                        <div className="w-full space-y-3">
                            {authSteps.slice(1, authStep + 1).map((step, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                                    <span className={idx === 3 ? "text-success font-bold" : "text-primary"}>
                                        {idx === 3 ? ">" : ">"}
                                    </span>
                                    <span className={idx === 3 ? "text-success drop-shadow-[0_0_8px_rgba(5,255,161,0.5)]" : "text-slate-300 typewriter-text"}>
                                        {step}
                                    </span>
                                </div>
                            ))}
                            {authStep < 4 && (
                                <div className="flex items-center gap-3 text-xs font-mono opacity-50">
                                    <span className="text-primary animate-pulse">_</span>
                                </div>
                            )}
                        </div>

                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-4">
                            <div
                                className={`h-full transition-all duration-500 ${authStep === 4 ? 'bg-success shadow-[0_0_10px_#05FFA1]' : 'bg-primary shadow-[0_0_10px_#00F0FF]'}`}
                                style={{ width: `${(authStep / 4) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5 font-mono">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">OPERATIVE EMAIL</label>
                            <input
                                type="email"
                                className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isAuthenticating}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">PASSCODE</label>
                            <input
                                type="password"
                                className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isAuthenticating}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAuthenticating}
                            className="w-full py-3 mt-4 bg-primary text-background-dark font-bold hover:bg-white hover:shadow-[0_0_15px_rgba(0,255,163,0.8)] transition-all tracking-widest disabled:opacity-50"
                        >
                            INITIALIZE UPLINK
                        </button>
                        <div className="text-center mt-4">
                            <span className="text-xs text-slate-500 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/auth/register')}>REQUEST CLEARANCE (REGISTER)</span>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
