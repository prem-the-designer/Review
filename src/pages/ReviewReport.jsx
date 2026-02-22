import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BarChart2, CheckCircle, AlertCircle, XCircle, RefreshCw, Save,
    Edit2, ArrowLeft, FileText, Eye, Cpu, Shield, Zap, Info,
    ThumbsUp, ThumbsDown, MessageSquare, Calendar, Tag, ExternalLink,
    ChevronDown, ChevronUp, AlertTriangle, Star
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

/* ──────────────────────────────────────────────
   AI / Verification Engine (Client-Side Logic)
   ────────────────────────────────────────────── */

function runVerificationAlgorithm(article) {
    const checks = [];
    let totalScore = 0;
    let maxScore = 0;

    // 1. Title quality
    const titleWords = article.heading?.split(/\s+/).filter(Boolean).length || 0;
    maxScore += 20;
    if (titleWords >= 5 && titleWords <= 20) {
        checks.push({ id: 'title_length', label: 'Title Length', status: 'pass', detail: `${titleWords} words — within ideal range (5–20)`, weight: 20, score: 20 });
        totalScore += 20;
    } else if (titleWords > 0) {
        const s = titleWords < 5 ? 10 : 12;
        checks.push({ id: 'title_length', label: 'Title Length', status: 'warn', detail: `${titleWords} words — ${titleWords < 5 ? 'too short' : 'a bit long'}, ideal is 5–20 words`, weight: 20, score: s });
        totalScore += s;
    } else {
        checks.push({ id: 'title_length', label: 'Title Length', status: 'fail', detail: 'Title is missing', weight: 20, score: 0 });
    }

    // 2. Content completeness
    const wordCount = article.word_count || article.content?.split(/\s+/).filter(Boolean).length || 0;
    maxScore += 25;
    if (wordCount >= 300) {
        checks.push({ id: 'content_length', label: 'Content Completeness', status: 'pass', detail: `${wordCount.toLocaleString()} words — comprehensive`, weight: 25, score: 25 });
        totalScore += 25;
    } else if (wordCount >= 100) {
        checks.push({ id: 'content_length', label: 'Content Completeness', status: 'warn', detail: `${wordCount} words — below recommended 300`, weight: 25, score: 15 });
        totalScore += 15;
    } else {
        checks.push({ id: 'content_length', label: 'Content Completeness', status: 'fail', detail: `Only ${wordCount} words — insufficient content`, weight: 25, score: 0 });
    }

    // 3. Source credibility
    maxScore += 15;
    if (article.source && article.source.trim().length > 0) {
        checks.push({ id: 'source', label: 'Source Attribution', status: 'pass', detail: `Source: "${article.source}"`, weight: 15, score: 15 });
        totalScore += 15;
    } else {
        checks.push({ id: 'source', label: 'Source Attribution', status: 'fail', detail: 'No source specified', weight: 15, score: 0 });
    }

    // 4. URL presence
    maxScore += 10;
    if (article.article_url && /^https?:\/\//.test(article.article_url)) {
        checks.push({ id: 'url', label: 'Source URL Verified', status: 'pass', detail: 'Valid URL provided', weight: 10, score: 10 });
        totalScore += 10;
    } else if (article.article_url) {
        checks.push({ id: 'url', label: 'Source URL Verified', status: 'warn', detail: 'URL format may be invalid', weight: 10, score: 5 });
        totalScore += 5;
    } else {
        checks.push({ id: 'url', label: 'Source URL Verified', status: 'warn', detail: 'No URL provided — recommended for credibility', weight: 10, score: 5 });
        totalScore += 5;
    }

    // 5. Category assigned
    maxScore += 10;
    if (article.content_categories && article.content_categories.length > 0) {
        checks.push({ id: 'category', label: 'Category Classification', status: 'pass', detail: `Classified as: ${article.content_categories.join(', ')}`, weight: 10, score: 10 });
        totalScore += 10;
    } else {
        checks.push({ id: 'category', label: 'Category Classification', status: 'fail', detail: 'No category assigned', weight: 10, score: 0 });
    }

    // 6. Date freshness
    maxScore += 10;
    if (article.published_date) {
        const daysOld = Math.floor((Date.now() - new Date(article.published_date).getTime()) / 86400000);
        if (daysOld <= 30) {
            checks.push({ id: 'freshness', label: 'Content Freshness', status: 'pass', detail: `Published ${daysOld} day${daysOld !== 1 ? 's' : ''} ago — current`, weight: 10, score: 10 });
            totalScore += 10;
        } else if (daysOld <= 180) {
            checks.push({ id: 'freshness', label: 'Content Freshness', status: 'warn', detail: `Published ${daysOld} days ago — moderately recent`, weight: 10, score: 6 });
            totalScore += 6;
        } else {
            checks.push({ id: 'freshness', label: 'Content Freshness', status: 'warn', detail: `Published ${daysOld} days ago — content may be outdated`, weight: 10, score: 3 });
            totalScore += 3;
        }
    } else {
        checks.push({ id: 'freshness', label: 'Content Freshness', status: 'warn', detail: 'No publication date provided', weight: 10, score: 4 });
        totalScore += 4;
    }

    // 7. Sentiment tagged
    maxScore += 5;
    if (article.sentiment) {
        checks.push({ id: 'sentiment', label: 'Sentiment Analysis', status: 'pass', detail: `Sentiment tagged: ${article.sentiment}`, weight: 5, score: 5 });
        totalScore += 5;
    } else {
        checks.push({ id: 'sentiment', label: 'Sentiment Analysis', status: 'warn', detail: 'Sentiment not tagged', weight: 5, score: 2 });
        totalScore += 2;
    }

    // 8. Summary / Abstract
    maxScore += 5;
    if (article.summary && article.summary.trim().length > 30) {
        checks.push({ id: 'summary', label: 'Summary / Abstract', status: 'pass', detail: 'Abstract provided', weight: 5, score: 5 });
        totalScore += 5;
    } else {
        checks.push({ id: 'summary', label: 'Summary / Abstract', status: 'warn', detail: 'No summary provided', weight: 5, score: 2 });
        totalScore += 2;
    }

    const finalScore = Math.round((totalScore / maxScore) * 100);
    const overallStatus = finalScore >= 75 ? 'approved' : finalScore >= 50 ? 'partial' : 'needs_revision';

    return { checks, score: finalScore, overallStatus };
}

function generateAISummary(article, verificationResult) {
    const { score, overallStatus } = verificationResult;
    const sentiment = article.sentiment || 'Neutral';
    const category = article.content_categories?.[0] || 'General';

    const sentiment_map = {
        Positive: 'presents an overall positive tone',
        Negative: 'carries a negative or cautionary tone',
        Neutral: 'maintains a balanced, neutral perspective',
    };

    const quality = score >= 75 ? 'high quality' : score >= 50 ? 'moderate quality' : 'requires improvement';

    return `This ${category} article "${article.heading?.substring(0, 60)}..." ${sentiment_map[sentiment] || 'has a mixed tone'}. ` +
        `The content has been algorithmically assessed as <strong>${quality}</strong> with a verification score of <strong>${score}%</strong>. ` +
        `${overallStatus === 'approved' ? 'The article meets all key reporting criteria and is ready for inclusion.' :
            overallStatus === 'partial' ? 'Several criteria are met; minor revisions are recommended before final inclusion.' :
                'Significant improvements are needed — key metadata or content fields are incomplete.'}` +
        ` Source attribution is ${article.source ? `from "${article.source}"` : 'not specified'}. ` +
        `Word count: approximately ${article.word_count || '—'} words.`;
}

/* ──────────────────────────────────────────────
   Status Configuration
   ────────────────────────────────────────────── */
const STATUS_CONFIG = {
    draft: { badge: 'badge-gray', label: 'Draft' },
    pending: { badge: 'badge-warning', label: 'Pending Review' },
    reviewing: { badge: 'badge-info', label: 'Under Review' },
    approved: { badge: 'badge-success', label: 'Approved' },
    rejected: { badge: 'badge-danger', label: 'Rejected' },
};

/* ──────────────────────────────────────────────
   Article Verification Card
   ────────────────────────────────────────────── */
function ArticleVerificationCard({ article, index, onUpdateNote, onApprove, onReject }) {
    const [expanded, setExpanded] = useState(false);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [note, setNote] = useState(article.reviewer_note || '');
    const [editNote, setEditNote] = useState(false);

    const runVerification = () => {
        setRunning(true);
        setExpanded(true);
        setTimeout(() => {
            const r = runVerificationAlgorithm(article);
            const summary = generateAISummary(article, r);
            setResult({ ...r, summary });
            setRunning(false);
        }, 1200); // simulate AI processing delay
    };

    const statusIcon = {
        pass: <CheckCircle size={15} color="var(--color-success)" />,
        warn: <AlertTriangle size={15} color="var(--color-warning)" />,
        fail: <XCircle size={15} color="var(--color-danger)" />,
    };

    const scoreLevel = result
        ? result.score >= 75 ? 'high' : result.score >= 50 ? 'medium' : 'low'
        : null;

    return (
        <div style={{
            border: '1px solid var(--color-gray-200)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: 'var(--color-white)',
            marginBottom: 14,
            boxShadow: 'var(--shadow-sm)',
            transition: 'box-shadow 0.2s',
        }}>
            {/* Article Header */}
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gray-400)', minWidth: 24, paddingTop: 2 }}>
                    #{index + 1}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-gray-800)', fontSize: 14, lineHeight: 1.4 }}>
                        {article.heading}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>{article.source}</span>
                        {article.content_categories && article.content_categories.length > 0 && (
                            <div style={{ display: 'flex', gap: 4 }}>
                                {article.content_categories.map(cat => (
                                    <span key={cat} className="badge badge-gray" style={{ fontSize: 10.5 }}>
                                        {cat.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        )}
                        {article.sentiment && (
                            <span className={`badge ${article.sentiment === 'Positive' ? 'badge-success' : article.sentiment === 'Negative' ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: 10.5 }}>
                                {article.sentiment}
                            </span>
                        )}
                        {article.published_date && (
                            <span style={{ fontSize: 11.5, color: 'var(--color-gray-400)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Calendar size={10} />
                                {format(new Date(article.published_date), 'dd MMM yyyy')}
                            </span>
                        )}
                        {article.article_url && (
                            <a href={article.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <ExternalLink size={10} /> Source
                            </a>
                        )}
                    </div>
                </div>

                {/* Score pill */}
                {result && (
                    <div style={{ textAlign: 'center', minWidth: 64 }}>
                        <div style={{
                            fontSize: 20, fontWeight: 800,
                            color: scoreLevel === 'high' ? 'var(--color-success)' : scoreLevel === 'medium' ? 'var(--color-warning)' : 'var(--color-danger)'
                        }}>
                            {result.score}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-gray-400)', textTransform: 'uppercase', fontWeight: 600 }}>AI Score</div>
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={runVerification}
                        disabled={running}
                        title="Run AI Verification"
                    >
                        {running ? <><span className="spinner spinner-sm" /> Analyzing...</> : <><Cpu size={13} /> Verify</>}
                    </button>
                    <button
                        className="btn btn-success btn-sm"
                        onClick={() => onApprove(article.id)}
                        title="Approve article"
                    >
                        <ThumbsUp size={13} />
                    </button>
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onReject(article.id)}
                        title="Reject article"
                    >
                        <ThumbsDown size={13} />
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExpanded(e => !e)}
                        title={expanded ? 'Collapse' : 'Expand'}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Expanded Verification Panel */}
            {expanded && (
                <div style={{ borderTop: '1px solid var(--color-gray-100)', padding: '16px 20px', background: 'var(--color-gray-50)' }}>
                    {running ? (
                        <div className="loading-wrapper" style={{ padding: 24 }}>
                            <div className="spinner" />
                            <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>AI Verification in progress...</span>
                        </div>
                    ) : result ? (
                        <>
                            {/* AI Summary */}
                            <div className="ai-review-panel" style={{ marginBottom: 16 }}>
                                <div className="ai-header">
                                    <span className="ai-badge"><Zap size={11} /> AI Analysis</span>
                                    <span style={{ fontSize: 13, color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                                        {result.overallStatus === 'approved' ? '✅ Ready for inclusion' :
                                            result.overallStatus === 'partial' ? '⚠️ Minor revisions needed' :
                                                '❌ Significant revisions required'}
                                    </span>
                                </div>
                                <p style={{ fontSize: 13.5, color: 'var(--color-gray-700)', lineHeight: 1.6 }}
                                    dangerouslySetInnerHTML={{ __html: result.summary }} />
                            </div>

                            {/* AI Score */}
                            <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div className="score-item">
                                    <div className="score-label">Verification Score</div>
                                    <div className={`score-value ${scoreLevel}`}>{result.score}%</div>
                                    <div className="progress-bar" style={{ width: 120, marginTop: 6 }}>
                                        <div className={`progress-fill ${scoreLevel}`} style={{ width: `${result.score}%` }} />
                                    </div>
                                </div>
                                <div className="score-item">
                                    <div className="score-label">Checks Passed</div>
                                    <div className="score-value high">
                                        {result.checks.filter(c => c.status === 'pass').length} / {result.checks.length}
                                    </div>
                                </div>
                                <div className="score-item">
                                    <div className="score-label">Warnings</div>
                                    <div className="score-value medium">
                                        {result.checks.filter(c => c.status === 'warn').length}
                                    </div>
                                </div>
                                <div className="score-item">
                                    <div className="score-label">Failed</div>
                                    <div className="score-value low">
                                        {result.checks.filter(c => c.status === 'fail').length}
                                    </div>
                                </div>
                            </div>

                            {/* Verification checklist */}
                            <div className="section-title" style={{ fontSize: 13, marginBottom: 10 }}>
                                <Shield size={14} /> Verification Checklist
                            </div>
                            <div className="verification-list">
                                {result.checks.map(check => (
                                    <div key={check.id} className={`verification-item ${check.status}`}>
                                        <div className="verification-item-label">
                                            {statusIcon[check.status]}
                                            {check.label}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>{check.detail}</span>
                                            <span style={{
                                                fontWeight: 700,
                                                fontSize: 12.5,
                                                color: check.status === 'pass' ? 'var(--color-success)' : check.status === 'warn' ? 'var(--color-warning)' : 'var(--color-danger)',
                                                minWidth: 40,
                                                textAlign: 'right'
                                            }}>
                                                {check.score}/{check.weight}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Reviewer Note */}
                            <div style={{ marginTop: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <MessageSquare size={14} color="var(--color-primary)" />
                                    <span className="fw-600" style={{ fontSize: 13 }}>Reviewer Note</span>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditNote(e => !e)} style={{ marginLeft: 'auto' }}>
                                        <Edit2 size={12} /> {editNote ? 'Cancel' : 'Edit'}
                                    </button>
                                </div>
                                {editNote ? (
                                    <div>
                                        <textarea
                                            className="form-textarea"
                                            rows={3}
                                            placeholder="Add your reviewer notes for this article..."
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => { onUpdateNote(article.id, note); setEditNote(false); }}>
                                                <Save size={13} /> Save Note
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: '10px 14px', background: 'var(--color-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)', fontSize: 13.5, color: note ? 'var(--color-gray-700)' : 'var(--color-gray-400)', lineHeight: 1.5 }}>
                                        {note || 'No notes added yet. Click Edit to add.'}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-gray-400)', fontSize: 13.5 }}>
                            <Cpu size={28} style={{ marginBottom: 8, opacity: 0.35 }} />
                            <p>Click <strong>Verify</strong> to run AI verification on this article.</p>
                        </div>
                    )}

                    {/* Article Preview */}
                    {article.summary && (
                        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-white)', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-gray-400)', marginBottom: 6 }}>Summary</div>
                            <p style={{ fontSize: 13.5, color: 'var(--color-gray-600)', lineHeight: 1.6 }}>{article.summary}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Review Report Page
   ────────────────────────────────────────────── */
export default function ReviewReport() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [report, setReport] = useState(null);
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [editReport, setEditReport] = useState(false);
    const [reportNotes, setReportNotes] = useState('');
    const [articleStatuses, setArticleStatuses] = useState({});

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const { data: reportData, error: rErr } = await supabase
                .from('reports').select('*').eq('id', id).single();
            if (rErr) throw rErr;
            setReport(reportData);
            setReportNotes(reportData.notes || '');

            const { data: linksData, error: lErr } = await supabase
                .from('report_articles')
                .select('article_id, order_index, reviewer_note, article_status')
                .eq('report_id', id)
                .order('order_index');
            if (lErr) throw lErr;

            if (linksData?.length) {
                const articleIds = linksData.map(l => l.article_id);
                const { data: articlesData, error: aErr } = await supabase
                    .from('articles').select('*').in('id', articleIds);
                if (aErr) throw aErr;

                const merged = linksData.map(link => ({
                    ...(articlesData?.find(a => a.id === link.article_id) || {}),
                    reviewer_note: link.reviewer_note,
                    order_index: link.order_index,
                }));
                merged.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                setArticles(merged);

                const statuses = {};
                linksData.forEach(l => { statuses[l.article_id] = l.article_status || 'pending'; });
                setArticleStatuses(statuses);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const updateArticleNote = async (articleId, note) => {
        await supabase
            .from('report_articles')
            .update({ reviewer_note: note })
            .eq('report_id', id)
            .eq('article_id', articleId);
    };

    const updateArticleStatus = async (articleId, status) => {
        setArticleStatuses(prev => ({ ...prev, [articleId]: status }));
        await supabase
            .from('report_articles')
            .update({ article_status: status })
            .eq('report_id', id)
            .eq('article_id', articleId);
    };

    const saveReport = async (newStatus) => {
        setSaving(true);
        try {
            const approvedCount = Object.values(articleStatuses).filter(s => s === 'approved').length;
            const totalAiScore = articles.length > 0 ? Math.round((approvedCount / articles.length) * 100) : null;

            const { error } = await supabase
                .from('reports')
                .update({
                    notes: reportNotes,
                    status: newStatus || report?.status,
                    ai_score: totalAiScore,
                    reviewed_at: new Date().toISOString(),
                    article_count: articles.length,
                })
                .eq('id', id);

            if (error) throw error;
            setSaveMsg('Report saved successfully!');
            setTimeout(() => setSaveMsg(''), 3000);
            fetchReport();
        } catch (err) {
            setSaveMsg('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="loading-wrapper">
            <div className="spinner" />
            <span>Loading report...</span>
        </div>
    );

    if (!report) return (
        <div className="empty-state">
            <AlertCircle size={48} />
            <h3>Report Not Found</h3>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/reports')}>Back to Reports</button>
        </div>
    );

    const approvedCount = Object.values(articleStatuses).filter(s => s === 'approved').length;
    const rejectedCount = Object.values(articleStatuses).filter(s => s === 'rejected').length;
    const pendingCount = articles.length - approvedCount - rejectedCount;
    const overallScore = articles.length > 0 ? Math.round((approvedCount / articles.length) * 100) : 0;

    return (
        <div>
            {/* Breadcrumb */}
            <div className="breadcrumb">
                <span className="breadcrumb-link" onClick={() => navigate('/')}>Home</span>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-link" onClick={() => navigate('/reports')}>Reports</span>
                <span className="breadcrumb-sep">/</span>
                <span>Review</span>
            </div>

            {/* Report Header */}
            <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                            <BarChart2 size={22} color="var(--color-primary)" />
                            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-gray-900)' }}>{report.title}</h1>
                            <span className={`badge ${STATUS_CONFIG[report.status]?.badge || 'badge-gray'}`}>
                                {STATUS_CONFIG[report.status]?.label}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-gray-500)' }}>
                            {report.client_name && <span><strong>Client:</strong> {report.client_name}</span>}
                            {report.report_type && <span><strong>Type:</strong> {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}</span>}
                            {report.period_start && report.period_end && (
                                <span>
                                    <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                                    {format(new Date(report.period_start), 'dd MMM yyyy')} – {format(new Date(report.period_end), 'dd MMM yyyy')}
                                </span>
                            )}
                            <span><FileText size={12} style={{ display: 'inline', marginRight: 4 }} />{articles.length} articles</span>
                        </div>
                    </div>

                    {/* Score Overview */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: overallScore >= 75 ? 'var(--color-success)' : overallScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                {overallScore}%
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Approval Rate</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ textAlign: 'center', padding: '8px 14px', background: '#d1fae5', borderRadius: 8 }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-success)' }}>{approvedCount}</div>
                                <div style={{ fontSize: 10.5, color: '#065f46', fontWeight: 600 }}>Approved</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px 14px', background: '#fef3c7', borderRadius: 8 }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-warning)' }}>{pendingCount}</div>
                                <div style={{ fontSize: 10.5, color: '#92400e', fontWeight: 600 }}>Pending</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px 14px', background: '#fee2e2', borderRadius: 8 }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-danger)' }}>{rejectedCount}</div>
                                <div style={{ fontSize: 10.5, color: '#991b1b', fontWeight: 600 }}>Rejected</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-gray-400)', marginBottom: 6 }}>
                        <span>Review Progress</span>
                        <span>{approvedCount + rejectedCount} / {articles.length} reviewed</span>
                    </div>
                    <div className="progress-bar" style={{ height: 10 }}>
                        <div
                            className={`progress-fill ${overallScore >= 75 ? 'high' : overallScore >= 50 ? 'medium' : 'low'}`}
                            style={{ width: `${articles.length ? ((approvedCount + rejectedCount) / articles.length) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Report Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reports')}>
                        <ArrowLeft size={14} /> Back
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditReport(e => !e)}>
                        <Edit2 size={14} /> {editReport ? 'Cancel Edit' : 'Edit Notes'}
                    </button>
                    <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => saveReport('reviewing')}>
                        {saving ? <><span className="spinner spinner-sm" /> Saving...</> : <><Save size={14} /> Save Progress</>}
                    </button>
                    <button className="btn btn-success btn-sm" disabled={saving} onClick={() => saveReport('approved')}>
                        <CheckCircle size={14} /> Approve Report
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={saving} onClick={() => saveReport('rejected')}>
                        <XCircle size={14} /> Reject Report
                    </button>
                </div>

                {saveMsg && (
                    <div className={`alert ${saveMsg.includes('Failed') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 12, marginBottom: 0 }}>
                        {saveMsg.includes('Failed') ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
                        {saveMsg}
                    </div>
                )}

                {/* Edit Notes Panel */}
                {editReport && (
                    <div style={{ marginTop: 16, padding: '14px', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                        <label className="form-label">Report Notes / Reviewer Comments</label>
                        <textarea
                            className="form-textarea"
                            rows={3}
                            value={reportNotes}
                            onChange={e => setReportNotes(e.target.value)}
                            placeholder="Add overall report notes..."
                        />
                    </div>
                )}
            </div>

            {/* Info Banner */}
            <div className="alert alert-info" style={{ marginBottom: 20 }}>
                <Info size={16} />
                <span>
                    Use the <strong>Verify</strong> button on each article to run automated quality checks and AI analysis.
                    Then <strong>Approve</strong> or <strong>Reject</strong> individual articles. Save your progress at any time.
                </span>
            </div>

            {/* Articles */}
            {articles.length === 0 ? (
                <div className="empty-state card">
                    <FileText size={48} />
                    <h3>No Articles in This Report</h3>
                    <p>Edit the report to add articles.</p>
                </div>
            ) : (
                <>
                    <div className="section-title">
                        <FileText size={16} /> Report Articles ({articles.length})
                    </div>
                    {articles.map((article, i) => (
                        <ArticleVerificationCard
                            key={article.id}
                            article={article}
                            index={i}
                            onUpdateNote={updateArticleNote}
                            onApprove={(aid) => updateArticleStatus(aid, 'approved')}
                            onReject={(aid) => updateArticleStatus(aid, 'rejected')}
                        />
                    ))}
                </>
            )}
        </div>
    );
}
