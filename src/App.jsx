import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import AddArticle from './pages/AddArticle';
import ViewArticles from './pages/ViewArticles';
import Reports from './pages/Reports';
import CreateReport from './pages/CreateReport';
import ReviewReport from './pages/ReviewReport';
import Newsletter from './pages/Newsletter';
import Standards from './pages/Standards';

function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Navbar />
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/articles" element={<ViewArticles />} />
            <Route path="/articles/add" element={<AddArticle />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/create" element={<CreateReport />} />
            <Route path="/reports/:id" element={<ReviewReport />} />
            <Route path="/newsletters" element={<Newsletter />} />
            <Route path="/standards" element={<Standards />} />
            {/* Catch all */}
            <Route path="*" element={
              <div className="empty-state" style={{ marginTop: 60 }}>
                <h3 style={{ fontSize: 48, fontWeight: 900, color: 'var(--color-gray-200)' }}>404</h3>
                <h3>Page Not Found</h3>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/" className="btn btn-primary mt-4" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
                  ← Back to Dashboard
                </a>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
