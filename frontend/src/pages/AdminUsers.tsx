import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Shield, Power, Trash2, Mail } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

export const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleStatus = async (userId: string, currentStatus: boolean) => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            if (res.ok) fetchUsers();
        } catch (err) {
            console.error(err);
        }
    };

    const deleteUser = async (userId: string) => {
        if (!window.confirm('Are you sure you want to terminate this user profile?')) return;

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchUsers();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden bg-background-dark font-mono">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="font-display font-bold text-2xl text-white uppercase tracking-tighter flex items-center gap-3">
                        <Users className="text-primary w-6 h-6" /> User Matrix Control
                    </h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Personnel Authorization & Role Allocation</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded font-bold text-[10px] uppercase shadow-neon animate-pulse hover:animate-none transition-all">
                    <UserPlus className="w-4 h-4" /> Provision New User
                </button>
            </div>

            <div className="flex-1 glass-panel rounded-xl border border-white/[0.03] overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#0D1117] border-b border-primary/20 z-10">
                        <tr>
                            <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Personnel</th>
                            <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Email Vector</th>
                            <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Role Hierarchy</th>
                            <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                            <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Last Access</th>
                            <th className="p-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-right">Operations</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-primary/[0.02] transition-colors group">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-primary">
                                            {u.name.charAt(0)}
                                        </div>
                                        <span className="text-xs font-bold text-white uppercase tracking-tighter">{u.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-[10px] font-mono text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3 h-3 text-slate-600" /> {u.email}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 text-[10px] font-bold">
                                        <Shield className={u.role === 'ADMIN' ? 'text-alert w-3 h-3' : 'text-primary w-3 h-3'} />
                                        <span className={u.role === 'ADMIN' ? 'text-alert' : 'text-primary'}>{u.role}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <Badge variant={u.isActive ? 'success' : 'alert'}>
                                        {u.isActive ? 'ACTIVE' : 'DISABLED'}
                                    </Badge>
                                </td>
                                <td className="p-4 text-[9px] font-mono text-slate-500">
                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'NEVER'}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => toggleStatus(u.id, u.isActive)}
                                            className={`p-1.5 rounded border transition-colors ${u.isActive ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-white' : 'border-success/30 text-success hover:bg-success hover:text-white'}`}
                                            title={u.isActive ? 'Suspend' : 'Reactivate'}
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => deleteUser(u.id)}
                                            className="p-1.5 rounded border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                            title="Terminate"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {loading && (
                    <div className="p-20 flex flex-col items-center justify-center gap-4">
                        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase animate-pulse">Scanning Personnel Database...</span>
                    </div>
                )}
            </div>
        </div>
    );
};
