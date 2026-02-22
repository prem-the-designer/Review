import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileCheck, Plus, Trash2, Edit, Save, X,
    Info, CheckCircle, AlertCircle, RefreshCw,
    Download, Layout
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Standards() {
    const navigate = useNavigate();
    const [standards, setStandards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        title: '',
        content: '',
        version: '1.0',
        is_active: true
    });

    const fetchStandards = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('standards')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStandards(data || []);
        } catch (err) {
            console.error('Error fetching standards:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStandards();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from('standards')
                    .update(form)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('standards')
                    .insert([form]);
                if (error) throw error;
            }

            setForm({ title: '', content: '', version: '1.0', is_active: true });
            setIsAdding(false);
            setEditingId(null);
            fetchStandards();
        } catch (err) {
            console.error('Error saving standard:', err);
            alert(`Failed to save standard: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (std) => {
        setForm({
            title: std.title,
            content: std.content,
            version: std.version,
            is_active: std.is_active
        });
        setEditingId(std.id);
        setIsAdding(true);
    };

    const cancelAction = () => {
        setIsAdding(false);
        setEditingId(null);
        setForm({ title: '', content: '', version: '1.0', is_active: true });
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            const { error } = await supabase
                .from('standards')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            fetchStandards();
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const deleteStandard = async (id) => {
        if (!confirm('Are you sure you want to delete this standard?')) return;
        try {
            const { error } = await supabase
                .from('standards')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchStandards();
        } catch (err) {
            console.error('Error deleting standard:', err);
        }
    };

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="page-header-icon-wrapper" style={{ background: 'var(--color-primary-light)' }}>
                        <FileCheck className="page-header-icon" size={22} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                        <h1>Editorial & Formatting Standards</h1>
                        <p style={{ margin: 0, color: 'var(--color-gray-500)', fontSize: 13 }}>
                            Define the editorial rules and formatting guidelines for reports and newsletters.
                        </p>
                    </div>
                </div>
                {!isAdding && (
                    <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                        <Plus size={16} /> Add Editorial Rule
                    </button>
                )}
            </div>

            {/* Info Box */}
            <div style={{
                background: '#f0f7ff', border: '1px solid #cce3ff',
                borderRadius: 8, padding: '15px 20px', marginBottom: 25,
                display: 'flex', gap: 12, alignItems: 'flex-start'
            }}>
                <Info size={20} style={{ color: '#0066cc', marginTop: 2 }} />
                <div style={{ fontSize: 13.5, color: '#004a99', lineHeight: 1.5 }}>
                    <strong>Purpose:</strong> These standards define the editorial quality of your reports. For example, you can add a rule for <strong>AP Style Headlines</strong>, <strong>Preferred Date Formats</strong>, or <strong>Summary Length</strong>. The system uses these guidelines to audit the final newsletter and report content for consistency.
                </div>
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <div className="card" style={{ marginBottom: 30, animation: 'slideIn 0.3s ease-out' }}>
                    <div className="section-title">
                        {editingId ? <Edit size={16} /> : <Plus size={16} />}
                        {editingId ? ' Edit Editorial Requirement' : ' New Editorial Requirement'}
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
                            <div className="form-group">
                                <label className="form-label">Rule Name *</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. AP Style Headline Formatting"
                                    required
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Version</label>
                                <input
                                    className="form-input"
                                    placeholder="1.0"
                                    value={form.version}
                                    onChange={e => setForm({ ...form, version: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Guideline Description *</label>
                            <textarea
                                className="form-textarea"
                                rows={6}
                                placeholder="Describe the editorial rule... (e.g. All newsletter headlines must follow AP Style: Capitalize only the first word and proper nouns, plus words with 4+ letters.)"
                                required
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                            <button type="button" className="btn btn-secondary" onClick={cancelAction}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? <RefreshCw className="spinner" size={16} /> : (editingId ? 'Update Rule' : 'Save Rule')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Standards List */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', gap: 15 }}>
                {loading ? (
                    <div className="loading-wrapper"><div className="spinner" /></div>
                ) : standards.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 200 }}>
                        <Layout size={40} style={{ color: 'var(--color-gray-300)', marginBottom: 15 }} />
                        <p>No standards uploaded yet.</p>
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsAdding(true)}>Create First Standard</button>
                    </div>
                ) : standards.map(std => (
                    <div key={std.id} className="card" style={{
                        borderLeft: std.is_active ? '4px solid var(--color-success)' : '4px solid var(--color-gray-300)',
                        padding: '18px 24px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{std.title}</h3>
                                    <span className="badge badge-gray" style={{ fontSize: 10 }}>v{std.version}</span>
                                    {std.is_active && (
                                        <span className="badge badge-success" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <CheckCircle size={10} /> Active
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 13.5, color: 'var(--color-gray-600)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {std.content}
                                </div>
                                <div style={{ marginTop: 15, fontSize: 11.5, color: 'var(--color-gray-400)' }}>
                                    Created on {new Date(std.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => startEdit(std)}
                                    title="Edit Rule"
                                >
                                    <Edit size={14} />
                                </button>
                                <button
                                    className={`btn btn-sm ${std.is_active ? 'btn-secondary' : 'btn-success'}`}
                                    onClick={() => toggleStatus(std.id, std.is_active)}
                                    title={std.is_active ? "Deactivate" : "Activate"}
                                >
                                    {std.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => deleteStandard(std.id)}
                                    style={{ color: 'var(--color-danger)' }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
