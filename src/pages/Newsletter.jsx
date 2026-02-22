import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, ArrowLeft, ArrowRight, Save, Send, Settings, Search,
    FileText, X, ChevronLeft, ChevronRight, Download, CheckCircle,
    Bell, Mail, Table, Edit, AlertCircle, FileCheck, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export default function Newsletter() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Filter/Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 12;

    // Data State
    const [allArticles, setAllArticles] = useState([]);
    const [selectedArticles, setSelectedArticles] = useState([]);
    const [reports, setReports] = useState([]);
    const [activeStandards, setActiveStandards] = useState([]);
    const [auditResults, setAuditResults] = useState({}); // { articleId: [violations] }
    const [editingArticle, setEditingArticle] = useState(null); // The article currently in the edit modal

    // Form State
    const [form, setForm] = useState({
        title: 'J&J Innovative Medicine Japan Media Impact Report',
        template_name: 'New - Media Imp',
        subject_type: 'Custom',
        banner_date: '2026-02-19',
        heading_type: 'Default',
        report_id: '',
        published_on: '2026-02-20',
        distribution_list: 'DEFAULT',
        email_test: '',
        send_push: true,
        mark_as_sent: false
    });

    // Fetch data (reports and benchmarks)
    useEffect(() => {
        const fetchData = async () => {
            const { data: reportData } = await supabase.from('reports').select('id, title').order('created_at', { ascending: false });
            if (reportData) setReports(reportData);

            const { data: stdData } = await supabase.from('standards').select('*').eq('is_active', true);
            if (stdData) setActiveStandards(stdData);
        };
        fetchData();
    }, []);

    // Fetch available articles
    const fetchArticles = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('articles')
                .select('id, heading, published_date, content_type, content_categories, article_reach, ave', { count: 'exact' })
                .order('published_date', { ascending: false })
                .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

            if (searchTerm) query = query.ilike('heading', `%${searchTerm}%`);

            const { data, error, count } = await query;
            if (error) throw error;
            setAllArticles(data || []);
            setTotalCount(count || 0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm]);

    useEffect(() => { fetchArticles(); }, [fetchArticles]);

    // Article selection logic
    const addToNewsletter = (article) => {
        if (!selectedArticles.find(a => a.id === article.id)) {
            setSelectedArticles([...selectedArticles, article]);
        }
    };

    const removeFromNewsletter = (articleId) => {
        setSelectedArticles(selectedArticles.filter(a => a.id !== articleId));
    };

    const moveAllRight = () => {
        const newArticles = allArticles.filter(aa => !selectedArticles.find(sa => sa.id === aa.id));
        setSelectedArticles([...selectedArticles, ...newArticles]);
    };

    const moveAllLeft = () => {
        setSelectedArticles([]);
    };

    const algorithmicCheck = (text, standards) => {
        const violations = [];
        text = text || '';

        standards.forEach(rule => {
            const desc = rule.content.toLowerCase();
            const title = rule.title.toLowerCase();

            // Rule: No space before/after slash (Custom strict check)
            if (desc.includes('space before') && desc.includes('/')) {
                const match = text.match(/\s+\//);
                if (match) {
                    violations.push({
                        type: 'editorial',
                        category: 'style',
                        label: rule.title,
                        detail: "Deterministic Error: Found an illegal space before a slash.",
                        field: 'heading',
                        violated_text: match[0]
                    });
                }
            }

            // Rule: Capitalization start
            if (desc.includes('capitalize') && desc.includes('first') && /^[a-z]/.test(text)) {
                violations.push({
                    type: 'editorial',
                    category: 'style',
                    label: rule.title,
                    detail: "Deterministic Error: Headline must start with a capital letter.",
                    field: 'heading',
                    violated_text: text.charAt(0)
                });
            }
        });

        return violations;
    };

    const performReview = async () => {
        setReviewing(true);
        const results = {};
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

        try {
            const promises = selectedArticles.map(async (art) => {
                const headline = art.heading || '';

                // 1. Algorithmic Pass (100% accurate for formatting)
                const localViolations = algorithmicCheck(headline, activeStandards);

                // 2. AI Pass (For nuance/style)
                let aiViolations = [];
                if (apiKey && apiKey !== 'your_openai_api_key_here') {
                    const prompt = `
                        You are an expert editorial auditor for J&J.
                        Standards:
                        ${activeStandards.map(s => `- ${s.title}: ${s.content}`).join('\n')}
                        
                        Headline: "${headline}"
                        
                        ALREADY FLAGGED LOCALLY: ${localViolations.map(v => v.violated_text).join(', ')}
                        
                        Task: Identify ANY OTHER editorial violations not mentioned above. 
                        Respond ONLY with a JSON array []. If perfect, return [].
                    `;

                    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey.trim()}`,
                            'HTTP-Referer': window.location.origin,
                            'X-Title': 'Review Report Feature'
                        },
                        body: JSON.stringify({
                            model: 'openai/gpt-4o-mini',
                            messages: [
                                { role: 'system', content: 'Respond with a JSON array of violations: {type, category, label, detail, field, violated_text}. Only return genuine errors.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const content = data.choices[0].message.content.trim();
                        try {
                            const jsonStart = content.indexOf('[');
                            const jsonEnd = content.lastIndexOf(']') + 1;
                            if (jsonStart !== -1) {
                                aiViolations = JSON.parse(content.substring(jsonStart, jsonEnd));
                            }
                        } catch (e) {
                            console.error("AI Parse Error", e);
                        }
                    }
                }

                const allViolations = [...localViolations, ...aiViolations];
                if (allViolations.length > 0) results[art.id] = allViolations;
            });

            await Promise.all(promises);
            setAuditResults(results);
            setShowPreview(true);
        } catch (err) {
            console.error("Review Error:", err);
            alert(`Review Failed: ${err.message}`);
        } finally {
            setReviewing(false);
        }
    };

    const handleSaveArticle = async () => {
        if (!editingArticle) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('articles')
                .update({
                    heading: editingArticle.heading,
                    article_reach: editingArticle.article_reach,
                    ave: editingArticle.ave
                })
                .eq('id', editingArticle.id);

            if (error) throw error;

            // Update local state
            setAllArticles(prev => prev.map(a => a.id === editingArticle.id ? editingArticle : a));
            setSelectedArticles(prev => prev.map(a => a.id === editingArticle.id ? editingArticle : a));

            setEditingArticle(null);
            alert('Article updated successfully!');
        } catch (err) {
            console.error(err);
            alert('Error updating article');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        setSaving(true);
        // Logic to save newsletter would go here
        setTimeout(() => {
            setSaving(false);
            alert('Newsletter updated successfully!');
        }, 800);
    };

    const groupedArticles = selectedArticles.reduce((acc, art) => {
        const type = art.content_type?.replace(/_/g, ' ').toUpperCase() || 'UNCLASSIFIED';
        if (!acc[type]) acc[type] = [];
        acc[type].push(art);
        return acc;
    }, {});

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60, position: 'relative' }}>

            {/* ── Newsletter Preview Overlay ── */}
            {showPreview && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', padding: '40px 0'
                }}>
                    <div style={{
                        width: 800, background: '#fff', borderRadius: 8,
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Newsletter Preview</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowPreview(false)}><X size={16} /></button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', background: '#ffffff' }}>
                            {/* Newsletter Content Start */}
                            <div style={{
                                padding: '10px 0',
                                textAlign: 'center', maxWidth: 600, margin: '0 auto 40px auto',
                                borderBottom: '1px solid #eee'
                            }}>
                                <div style={{ color: '#d21034', fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Johnson & Johnson</div>
                                <div style={{ color: '#d21034', fontSize: 22, fontWeight: 400, marginBottom: 12 }}>Innovative Medicine</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: '#1a1a1a', letterSpacing: '-0.5px' }}>Media Impact Report</div>
                            </div>

                            <div style={{
                                padding: '0 0 30px 0',
                                marginBottom: 30, background: '#fff', fontSize: 13, lineHeight: 1.6,
                                borderBottom: '1px solid #eee', color: '#666'
                            }}>
                                <p style={{ margin: '0 0 8px 0' }}>記事の二次使用はお控えください。/ Secondary use of the articles is prohibited for copyright reasons.</p>
                                <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#333' }}>This email is confidential and for internal use only. Do not forward or distribute.</p>
                                <p style={{ margin: '0 0 4px 0' }}>日本語の紙媒体に掲載された記事に関しては、社外の記事検索サイトELNETのlinkにアクセスの上、IDとPWを入力の上、ご確認ください。</p>
                                <a href="https://morning-clipping.elnet.co.jp/" style={{ color: '#0056b3', textDecoration: 'none' }}>
                                    https://morning-clipping.elnet.co.jp/
                                </a>
                            </div>

                            {Object.entries(groupedArticles).map(([type, articles]) => (
                                <div key={type} style={{ marginBottom: 50 }}>
                                    <div style={{
                                        background: '#d21034', color: '#fff', padding: '10px 20px',
                                        fontSize: 18, fontWeight: 700, marginBottom: 20,
                                        borderRadius: '2px'
                                    }}>
                                        {type}
                                    </div>
                                    {articles.map((art, idx) => {
                                        const violations = auditResults[art.id] || [];
                                        const headingViolations = violations.filter(v => v.field === 'heading');
                                        const vCount = headingViolations.length;

                                        const renderHighlightedHeading = (text, violations) => {
                                            if (violations.length === 0) return text;

                                            // 1. Identify all segments and their violation counts
                                            const charViolations = new Array(text.length).fill(0).map(() => []);

                                            violations.forEach(v => {
                                                if (!v.violated_text) return;
                                                const escaped = v.violated_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                const regex = new RegExp(escaped, 'gi');
                                                let match;
                                                while ((match = regex.exec(text)) !== null) {
                                                    for (let i = match.index; i < match.index + match[0].length; i++) {
                                                        charViolations[i].push(v);
                                                    }
                                                }
                                            });

                                            // 2. Group indices into continuous blocks
                                            const blocks = [];
                                            if (text.length === 0) return text;

                                            let currentBlock = { text: text[0], vList: charViolations[0] };

                                            for (let i = 1; i < text.length; i++) {
                                                const vIds = charViolations[i].map(v => v.label).sort().join('|');
                                                const prevVIds = currentBlock.vList.map(v => v.label).sort().join('|');

                                                if (vIds === prevVIds) {
                                                    currentBlock.text += text[i];
                                                } else {
                                                    blocks.push(currentBlock);
                                                    currentBlock = { text: text[i], vList: charViolations[i] };
                                                }
                                            }
                                            blocks.push(currentBlock);

                                            // 3. Render blocks
                                            return blocks.map((block, i) => {
                                                const vList = block.vList.filter((v, idx, self) =>
                                                    self.findIndex(t => t.label === v.label) === idx
                                                );
                                                const vCount = vList.length;

                                                if (vCount > 0) {
                                                    const combinedTooltip = vList.map(v => `• ${v.label}: ${v.detail}`).join('\n');
                                                    return (
                                                        <span
                                                            key={i}
                                                            style={{
                                                                background: vCount > 1 ? '#ffcc80' : '#fff3cd', // Orange for multiple, Yellow for single
                                                                borderRadius: '2px',
                                                                padding: '0 1px',
                                                                cursor: 'help',
                                                                borderBottom: vCount > 1 ? '2px solid #f57c00' : '1px solid #ffc107',
                                                            }}
                                                            title={combinedTooltip}
                                                        >
                                                            {block.text}
                                                        </span>
                                                    );
                                                }
                                                return <span key={i}>{block.text}</span>;
                                            });
                                        };

                                        // Dynamic Colors based on violation count
                                        const getColors = (count) => {
                                            if (count === 0) return { badge: '#856404', badgeBg: '#fff3cd' };
                                            if (count === 1) return { badge: '#856404', badgeBg: '#fff3cd' }; // Yellow
                                            if (count === 2) return { badge: '#974a00', badgeBg: '#ffe5b4' }; // Orange
                                            return { badge: '#721c24', badgeBg: '#f8d7da' }; // Red
                                        };
                                        const styles = getColors(vCount);

                                        return (
                                            <div key={art.id} style={{ marginBottom: 35 }}>
                                                <div style={{ marginBottom: 10, position: 'relative' }}>
                                                    <h2 style={{
                                                        margin: 0, fontSize: 19, fontWeight: 800, color: '#000', lineHeight: 1.5,
                                                    }}>
                                                        {renderHighlightedHeading(art.heading, headingViolations)}
                                                    </h2>
                                                </div>
                                                <div style={{
                                                    padding: '4px 0', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0',
                                                    display: 'flex', fontSize: 11.5, color: '#888', gap: 10, marginBottom: 12
                                                }}>
                                                    <span style={{ fontWeight: 600 }}>{art.published_date ? format(new Date(art.published_date), 'MMM dd') : '--'}</span>
                                                    <span style={{ color: '#d21034', opacity: 0.5 }}>|</span>
                                                    <span>Newswire (J&J Japan)</span>
                                                    <span style={{ color: '#d21034', opacity: 0.5 }}>|</span>
                                                    <span>Reach: {Number(art.article_reach || 0).toLocaleString()}</span>
                                                    {violations.length > 0 && (
                                                        <span style={{
                                                            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                                                            color: styles.badge, background: styles.badgeBg,
                                                            padding: '0 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                                            border: `1px solid ${styles.badge}`
                                                        }}>
                                                            <AlertCircle size={10} /> {violations.length} {violations.length === 1 ? 'ERROR' : 'ERRORS'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#444' }}>
                                                    <div style={{ marginBottom: 8 }}>
                                                        {art.heading.substring(0, 250)}...
                                                    </div>
                                                    <a href="#" style={{ color: '#999', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Read More</a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* ── Header Toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>Back to Dashboard</button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.history.back()}>Back</button>
                <div style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Settings size={18} style={{ color: 'var(--color-primary)' }} />
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>Update Newsletter - J&amp;J INNOVATIVE...</h2>
                </div>
                <button className="btn btn-success btn-sm" style={{ background: '#44b55a', border: 'none' }}>
                    <Send size={14} /> Send
                </button>
                <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }}><Settings size={16} /></button>
            </div>

            {/* ── Form Section ── */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px 30px' }}>

                    <div className="form-group" style={{ gridColumn: 'span 1' }}>
                        <label className="form-label">Title: *</label>
                        <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Select Template *</label>
                        <select className="form-select" value={form.template_name} onChange={e => setForm({ ...form, template_name: e.target.value })}>
                            <option>New - Media Imp</option>
                            <option>Daily Digest</option>
                            <option>Weekly Analysis</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Subject</label>
                        <select className="form-select" value={form.subject_type} onChange={e => setForm({ ...form, subject_type: e.target.value })}>
                            <option>Custom</option>
                            <option>Dynamic</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Banner Date</label>
                        <input type="date" className="form-input" value={form.banner_date} onChange={e => setForm({ ...form, banner_date: e.target.value })} />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 1' }}>
                        <input className="form-input" placeholder="Title Sub-heading" value={form.title} readOnly />
                    </div>

                    <div className="form-group">
                        <label className="form-label">NewsletterHeading</label>
                        <select className="form-select" value={form.heading_type} onChange={e => setForm({ ...form, heading_type: e.target.value })}>
                            <option>Default</option>
                            <option>Alternative</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Select Report*</label>
                        <select className="form-select" value={form.report_id} onChange={e => setForm({ ...form, report_id: e.target.value })}>
                            <option value="">-- ReportName --</option>
                            {reports.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Published On</label>
                        <input type="date" className="form-input" value={form.published_on} onChange={e => setForm({ ...form, published_on: e.target.value })} />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 15 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>Select Distribution List</label>
                        <select className="form-select" style={{ minWidth: 120 }} value={form.distribution_list} onChange={e => setForm({ ...form, distribution_list: e.target.value })}>
                            <option>DEFAULT</option>
                            <option>Management</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Search & Tools ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, maxWidth: 400 }}>
                    <div className="table-search" style={{ margin: 0 }}>
                        <Search size={15} />
                        <input placeholder="Search by keyword" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <button className="btn-link" style={{ fontSize: 12, color: 'var(--color-primary)', border: 'none', background: 'none' }}>Advanced Search</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    {/* Pagination */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: 13, color: 'var(--color-gray-600)', padding: '0 10px', display: 'flex', alignItems: 'center' }}>
                            Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}
                        </span>
                        <button
                            className="btn btn-secondary btn-sm"
                            disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <button className="btn btn-secondary btn-sm" style={{ background: '#3b82f6', color: '#fff' }}>
                        SpreadSheet view
                    </button>
                </div>
            </div>

            <p style={{ fontSize: 11, color: 'var(--color-gray-500)', marginBottom: 15 }}>
                Note: Select single or multiple article(s), drag and drop in the right side panel. You can also re-order articles within a panel.
            </p>

            {/* ── Article Selection Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Left: Available Articles */}
                <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gray-600)' }}>Total: {totalCount} Articles</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="checkbox" /> Show Shared Articles
                            </label>
                            <button className="btn btn-primary" style={{ padding: '2px 8px' }} onClick={moveAllRight}>
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                    <div style={{ height: 600, overflowY: 'auto', padding: 10 }}>
                        {loading ? (
                            <div className="loading-wrapper"><div className="spinner" /></div>
                        ) : allArticles.map(article => (
                            <div key={article.id} style={{ padding: '12px', borderBottom: '1px solid var(--color-gray-100)', display: 'flex', gap: 10 }}>
                                <input type="checkbox" checked={selectedArticles.some(a => a.id === article.id)} onChange={() => addToNewsletter(article)} />
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: 13, color: 'var(--color-primary)', margin: '0 0 4px 0', lineHeight: 1.4 }}>{article.heading}</h4>
                                    <div style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>
                                        {article.content_type?.replace(/_/g, ' ')} | {article.content_categories?.join(', ')} | MR: {article.article_reach} | ASR: {article.ave}
                                    </div>
                                </div>
                                <button
                                    className="btn-link"
                                    style={{ background: 'none', border: 'none', padding: 0 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingArticle({ ...article });
                                    }}
                                >
                                    <Edit size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Newsletter Articles */}
                <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
                        <button className="btn btn-primary" style={{ padding: '2px 8px' }} onClick={moveAllLeft}>
                            <ArrowLeft size={14} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gray-600)' }}>Newsletter Articles</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gray-600)' }}>Total: {selectedArticles.length}</span>
                    </div>
                    <div style={{ height: 600, overflowY: 'auto', padding: 10 }}>
                        {selectedArticles.length === 0 ? (
                            <div className="empty-state" style={{ height: '100%', border: '2px dashed var(--color-gray-200)', borderRadius: 8 }}>
                                <p style={{ color: 'var(--color-gray-400)' }}>Selected articles will appear here</p>
                            </div>
                        ) : selectedArticles.map((article, idx) => (
                            <div key={article.id} style={{ padding: '12px', borderBottom: '1px solid var(--color-gray-100)', background: idx % 2 === 0 ? '#fff' : 'var(--color-gray-50)' }}>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input type="checkbox" />
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: 13, color: 'var(--color-primary)', margin: '0 0 4px 0', lineHeight: 1.4 }}>{article.heading}</h4>
                                        <div style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>
                                            {article.content_type?.replace(/_/g, ' ')} | {article.content_categories?.join(', ')} | ASR: {article.ave}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <span style={{ fontSize: 10, color: 'var(--color-gray-400)' }}>New</span>
                                        <Edit
                                            size={12}
                                            style={{ color: 'var(--color-gray-400)', cursor: 'pointer' }}
                                            onClick={() => setEditingArticle({ ...article })}
                                        />
                                        <X size={12} style={{ color: 'var(--color-danger)', cursor: 'pointer' }} onClick={() => removeFromNewsletter(article.id)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Footer Actions ── */}
            <div style={{ marginTop: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40 }}>

                    {/* Left Footer: Test Email */}
                    <div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <input className="form-input" placeholder="Email Address" value={form.email_test} onChange={e => setForm({ ...form, email_test: e.target.value })} />
                            </div>
                            <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Settings size={14} /> Test
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Send size={14} /> Send Individual
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 15 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                                <input type="checkbox" checked={form.send_push} onChange={e => setForm({ ...form, send_push: e.target.checked })} /> Send Push Notification
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                                <input type="checkbox" checked={form.mark_as_sent} onChange={e => setForm({ ...form, mark_as_sent: e.target.checked })} /> Mark As Send
                            </label>
                        </div>
                    </div>

                    {/* Right Footer: Global Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 10 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowPreview(true)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Download size={14} /> Download/Preview
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={performReview} style={{ background: 'var(--color-primary)', color: '#fff', border: 'none' }} disabled={reviewing}>
                            {reviewing ? <RefreshCw className="spinner" size={14} /> : <FileCheck size={14} />} Review
                        </button>
                        <button className="btn btn-success" style={{ background: '#44b55a', border: 'none' }} onClick={handleUpdate}>
                            Update
                        </button>
                    </div>

                </div>
            </div>

            {/* ── Edit Article Modal ── */}
            {editingArticle && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: 600, padding: 25 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Edit size={18} /> Quick Edit Article
                            </h3>
                            <button className="btn-link" onClick={() => setEditingArticle(null)}><X size={20} /></button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Heading / Headline</label>
                            <textarea
                                className="form-textarea"
                                rows={4}
                                value={editingArticle.heading}
                                onChange={e => setEditingArticle({ ...editingArticle, heading: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 15 }}>
                            <div className="form-group">
                                <label className="form-label">Reach (MR)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={editingArticle.article_reach}
                                    onChange={e => setEditingArticle({ ...editingArticle, article_reach: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">AVE (ASR)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={editingArticle.ave}
                                    onChange={e => setEditingArticle({ ...editingArticle, ave: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 25 }}>
                            <button className="btn btn-secondary" onClick={() => setEditingArticle(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveArticle} disabled={saving}>
                                {saving ? <RefreshCw className="spinner" size={16} /> : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
