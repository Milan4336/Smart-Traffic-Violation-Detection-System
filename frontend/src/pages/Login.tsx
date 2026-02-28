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
        <div className="flex items-center justify-center min-h-screen bg-background-dark text-white p-4 relative overflow-hidden">
            {/* Background Narrative Animation */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"></div>
                <div className="grid grid-cols-12 gap-4 h-full w-full p-4 overflow-hidden">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="flex flex-col gap-2 animate-pulse" style={{ animationDelay: `${i * 150}ms`, opacity: Math.random() }}>
                            {Array.from({ length: 20 }).map((_, j) => (
                                <div key={j} className="h-1 w-full bg-primary/20 rounded"></div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="max-w-md w-full glass-panel p-8 rounded-lg relative z-10 overflow-hidden scanline-effect border border-primary/20 shadow-[0_0_50px_rgba(0,240,255,0.2)]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_#00F0FF]"></div>

                <div className="flex flex-col items-center mb-8">
                    <div className="size-20 rounded-full border border-primary/50 flex items-center justify-center mb-4 bg-primary/5 shadow-[0_0_20px_rgba(0,240,255,0.2)] relative">
                        <div className="absolute inset-0 border border-primary rounded-full animate-ping opacity-20"></div>
                        <Shield className="w-10 h-10 text-primary drop-shadow-[0_0_8px_#00F0FF]" />
                    </div>
                    <h2 className="text-4xl font-display font-bold tracking-[0.2em] text-center">NEON <span className="text-primary">GUARDIAN</span></h2>
                    <div className="h-0.5 w-24 bg-primary/30 mt-2"></div>
                    <p className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.4em] mt-3">PROPRIETARY SURVEILLANCE NODE</p>
                </div>

                {error && (
                    <div className="border border-alert bg-alert/5 text-alert p-3 mb-6 rounded text-[10px] font-mono text-center animate-shake uppercase tracking-tighter">
                        CRITICAL ERROR: {error}
                    </div>
                )/* Rest of logic... */}

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
