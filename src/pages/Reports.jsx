import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Plus, Search, Eye, Trash2, RefreshCw,
    ChevronLeft, ChevronRight, BarChart2, CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const STATUS_CONFIG = {
    draft: { badge: 'badge-gray', icon: Clock, label: 'Draft' },
    pending: { badge: 'badge-warning', icon: Clock, label: 'Pending Review' },
    reviewing: { badge: 'badge-info', icon: RefreshCw, label: 'Under Review' },
    approved: { badge: 'badge-success', icon: CheckCircle, label: 'Approved' },
    rejected: { badge: 'badge-danger', icon: AlertCircle, label: 'Rejected' },
};

const PAGE_SIZE = 10;

export default function Reports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [deleteId, setDeleteId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('reports')
                .select('*, report_articles(count)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

            if (searchTerm) query = query.ilike('title', `%${searchTerm}%`);
            if (filterStatus) query = query.eq('status', filterStatus);

            const { data, error, count } = await query;
            if (error) throw error;
            setReports(data || []);
            setTotal(count || 0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterStatus, page]);

    useEffect(() => { setPage(1); }, [searchTerm, filterStatus]);
    useEffect(() => { fetchReports(); }, [fetchReports]);

    const handleDelete = async (id) => {
        setDeleting(true);
        try {
            await supabase.from('report_articles').delete().eq('report_id', id);
            await supabase.from('reports').delete().eq('id', id);
            setDeleteId(null);
            fetchReports();
        } catch (err) {
            console.error(err);
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const StatusBadge = ({ status }) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
        const Icon = config.icon;
        return (
            <span className={`badge ${config.badge}`}>
                <Icon size={10} /> {config.label}
            </span>
        );
    };

    return (
        <div>
            {/* Breadcrumb */}
            <div className="breadcrumb">
                <span className="breadcrumb-link" onClick={() => navigate('/')}>Home</span>
                <span className="breadcrumb-sep">/</span>
                <span>Analysis Reports</span>
            </div>

            {/* Page Header */}
            <div className="page-header">
                <BarChart2 className="page-header-icon" size={22} />
                <h1>Analysis Reports</h1>
                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/reports/create')}>
                        <Plus size={14} /> Create Report
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        <Search size={15} />
                        <input
                            placeholder="Search reports..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <select
                            className="form-select"
                            style={{ minWidth: 160, padding: '7px 12px' }}
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                        <button className="btn btn-secondary btn-sm" onClick={fetchReports} title="Refresh">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-wrapper">
                        <div className="spinner" />
                        <span>Loading reports...</span>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <h3>No Reports Found</h3>
                        <p>Create your first analysis report.</p>
                        <button className="btn btn-primary mt-4" onClick={() => navigate('/reports/create')}>
                            <Plus size={14} /> Create Report
                        </button>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Report Title</th>
                                <th>Client</th>
                                <th>Period</th>
                                <th>Articles</th>
                                <th>AI Score</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report, i) => (
                                <tr key={report.id}>
                                    <td style={{ color: 'var(--color-gray-400)', fontSize: 12 }}>
                                        {(page - 1) * PAGE_SIZE + i + 1}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>{report.title}</div>
                                        {report.description && (
                                            <div style={{ fontSize: 12, color: 'var(--color-gray-400)', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {report.description}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{report.client_name || '—'}</td>
                                    <td style={{ fontSize: 12.5 }}>
                                        {report.period_start && report.period_end ? (
                                            <span>
                                                {format(new Date(report.period_start), 'dd MMM yyyy')} –<br />
                                                {format(new Date(report.period_end), 'dd MMM yyyy')}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                            {report.report_articles?.[0]?.count ?? '—'}
                                        </span>
                                    </td>
                                    <td>
                                        {report.ai_score != null ? (
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 15, color: report.ai_score >= 75 ? 'var(--color-success)' : report.ai_score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                                    {report.ai_score}%
                                                </div>
                                                <div className="progress-bar" style={{ width: 60 }}>
                                                    <div
                                                        className={`progress-fill ${report.ai_score >= 75 ? 'high' : report.ai_score >= 50 ? 'medium' : 'low'}`}
                                                        style={{ width: `${report.ai_score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : <span style={{ color: 'var(--color-gray-400)' }}>Not reviewed</span>}
                                    </td>
                                    <td><StatusBadge status={report.status} /></td>
                                    <td style={{ fontSize: 12.5 }}>
                                        {report.created_at ? format(new Date(report.created_at), 'dd MMM yyyy') : '—'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                title="View & Review"
                                                onClick={() => navigate(`/reports/${report.id}`)}
                                            >
                                                <Eye size={13} />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                title="Delete"
                                                onClick={() => setDeleteId(report.id)}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--color-gray-200)' }}>
                        <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                            <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)}>{p}</button>
                        ))}
                        <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="modal-overlay" onClick={() => setDeleteId(null)}>
                    <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><Trash2 size={18} /> Delete Report</h2>
                            <button className="modal-close" onClick={() => setDeleteId(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--color-gray-600)', lineHeight: 1.6 }}>
                                Are you sure? This will permanently delete the report and all its linked articles. This action <strong>cannot be undone</strong>.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                            <button className="btn btn-danger" disabled={deleting} onClick={() => handleDelete(deleteId)}>
                                {deleting ? <><span className="spinner spinner-sm" /> Deleting...</> : <><Trash2 size={14} /> Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
