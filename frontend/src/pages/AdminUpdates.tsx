import React, { useState } from 'react';

export const AdminUpdates: React.FC = () => {
    const [versionData, setVersionData] = useState({
        version_number: '', release_name: '', release_type: 'minor', release_status: 'released'
    });

    const handleCreateVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiUrl}/system/version/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(versionData)
            });
            if (res.ok) alert('Version deployed successfully!');
            else alert('Failed to create version');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="p-8 font-mono text-sm max-w-4xl">
            <h2 className="text-2xl font-bold text-primary mb-6">ADMIN TERMINAL - SYSTEM UPGRADES</h2>

            <div className="mb-10 bg-slate-900 border border-slate-700 p-6 rounded">
                <h3 className="text-lg text-white mb-4">DEPLOY NEW VERSION</h3>
                <form onSubmit={handleCreateVersion} className="grid grid-cols-2 gap-4">
                    <input className="bg-slate-800 border-slate-700 text-white p-2" type="text" placeholder="version_number (e.g. v2.0.0)" value={versionData.version_number} onChange={e => setVersionData({ ...versionData, version_number: e.target.value })} />
                    <input className="bg-slate-800 border-slate-700 text-white p-2" type="text" placeholder="release_name" value={versionData.release_name} onChange={e => setVersionData({ ...versionData, release_name: e.target.value })} />
                    <select className="bg-slate-800 border-slate-700 text-white p-2" value={versionData.release_type} onChange={e => setVersionData({ ...versionData, release_type: e.target.value })}>
                        <option value="major">MAJOR</option><option value="minor">MINOR</option><option value="patch">PATCH</option>
                    </select>
                    <select className="bg-slate-800 border-slate-700 text-white p-2" value={versionData.release_status} onChange={e => setVersionData({ ...versionData, release_status: e.target.value })}>
                        <option value="draft">DRAFT</option><option value="released">RELEASED</option>
                    </select>
                    <button type="submit" className="col-span-2 bg-primary/20 text-primary border border-primary p-2 mt-2 hover:bg-primary hover:text-black transition-colors">INITIATE DEPLOYMENT</button>
                </form>
            </div>
            <div className="bg-slate-900 border border-slate-700 p-6 rounded opacity-50 pointer-events-none">
                <h3 className="text-lg text-white mb-4">INJECT PATCH NOTES (WIP)</h3>
                <p className="text-slate-500 mb-4">Create a version first, then map patch notes to the returned ID.</p>
                <form className="grid grid-cols-2 gap-4">
                    <input className="bg-slate-800 border-slate-700 text-white p-2 col-span-2" type="text" placeholder="version_id UUID" disabled />
                    <input className="bg-slate-800 border-slate-700 text-white p-2" type="text" placeholder="title" disabled />
                    <input className="bg-slate-800 border-slate-700 text-white p-2" type="text" placeholder="description" disabled />
                    <button type="submit" className="col-span-2 bg-slate-700 text-slate-400 p-2 mt-2" disabled>INJECT PATCH</button>
                </form>
            </div>
        </div>
    );
};
