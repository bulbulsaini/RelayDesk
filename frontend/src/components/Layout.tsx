
import React, { useState } from 'react';
import {
  Activity,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plus,
  ShieldCheck,
} from 'lucide-react';

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/format';
import { NotificationBell } from './NotificationBell';
import { TicketModal } from './TicketModal';

interface LayoutProps {
  children: React.ReactNode;
  openCount?: number;
  onTicketCreated?: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/tickets': 'Support Tickets',
  '/history': 'History',
  '/activity': 'Event & Audit Log',
};

export function Layout({
  children,
  openCount,
  onTicketCreated,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  const pageTitle =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/tickets/')
      ? 'Ticket Details'
      : 'Workspace');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">RD</div>
            <div>
              <div className="brand-name">RelayDesk</div>
              <div className="brand-sub">
                {isAdmin ? 'Admin Console' : 'Support Portal'}
              </div>
            </div>
          </div>

          {/* Only customers can create tickets */}
          {!isAdmin && (
            <button
              type="button"
              className="btn btn-primary sidebar-cta"
              onClick={() => setModalOpen(true)}
            >
              <Plus size={15} />
              New Ticket
            </button>
          )}

          <div className="nav-section-label">Workspace</div>

          <nav className="nav-list">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-link-inner">
                <LayoutDashboard size={16} />
                Overview
              </span>
            </NavLink>

            <NavLink
              to="/tickets"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-link-inner">
                <Inbox size={16} />
                {isAdmin ? 'All Tickets' : 'My Tickets'}
              </span>

              {openCount !== undefined && (
                <span className="nav-pill">{openCount}</span>
              )}
            </NavLink>

            <NavLink
              to="/history"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-link-inner">
                <History size={16} />
                History
              </span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/activity"
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <span className="nav-link-inner">
                  <Activity size={16} />
                  Activity Log
                </span>
              </NavLink>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className={`avatar ${isAdmin ? 'admin' : ''}`}>
              {getInitials(user.name)}
            </div>

            <div className="user-meta">
              <div className="user-name">{user.name}</div>
              <div className="user-role-tag">
                {isAdmin ? 'Administrator' : 'Member'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ justifyContent: 'flex-start' }}
            onClick={logout}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title-group">
            <h1 className="topbar-title">{pageTitle}</h1>

            <span className={`role-badge ${isAdmin ? 'admin' : ''}`}>
              {isAdmin ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ShieldCheck size={12} />
                  Admin Mode
                </span>
              ) : (
                'Customer Workspace'
              )}
            </span>
          </div>

          <div className="topbar-actions">
            <NotificationBell />

            {/* Only customers can raise tickets */}
            {!isAdmin && (
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => setModalOpen(true)}
              >
                <Plus size={14} />
                Raise Ticket
              </button>
            )}
          </div>
        </header>

        <main className="page-container">{children}</main>
      </div>

      {/* Ticket creation modal is only available to customers */}
      {!isAdmin && (
        <TicketModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={(created) => {
            onTicketCreated?.();
            navigate(`/tickets/${created.id}`);
          }}
        />
      )}
    </div>
  );
}
