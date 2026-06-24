import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import Sidebar, { NAV } from './Sidebar';
import { useLanguage } from '../context/LanguageContext';

// ── Layout ──────────────────────────────────────────────────────────────────
const Layout = ({ children }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { language, setLanguage, t } = useLanguage();

  // Generate breadcrumbs with labels from NAV
  const getBreadcrumbs = () => {
    if (currentPath === '/') return [];

    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [];
    let pathAcc = '';

    parts.forEach((part, index) => {
      pathAcc += `/${part}`;

      // Look for label in NAV
      let foundLabel = part;

      // Search top level
      const topMatch = NAV.find(item => item.to === pathAcc || item.key === part);
      if (topMatch) {
        foundLabel = t(topMatch.label);
      } else {
        // Search children
        NAV.forEach(parent => {
          if (parent.children) {
            const childMatch = parent.children.find(c => c.to === pathAcc);
            if (childMatch) {
              foundLabel = t(childMatch.label);
            }
          }
        });
      }

      crumbs.push({
        label: foundLabel,
        to: pathAcc,
        active: index === parts.length - 1
      });
    });

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main ── */}
      <main className="main-wrapper">
        <header className="top-bar">
          <div className="breadcrumb-nav">
            <Link to="/" className="breadcrumb-item">{t('Home')}</Link>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <span className="breadcrumb-separator">/</span>
                <span className={`breadcrumb-item ${crumb.active ? 'active' : ''}`}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', paddingRight: '20px' }}>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                background: 'transparent',
                border: '1px solid #DCDCDC',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#191919',
                cursor: 'pointer',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              <option value="EN">EN</option>
              <option value="DE">DE</option>
              <option value="CN">CN</option>
            </select>
          </div>
        </header>

        <section className="content-area">
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;
