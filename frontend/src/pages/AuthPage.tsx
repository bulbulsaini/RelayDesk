
import React, { useState } from 'react';
import './AuthPage.css';
import {
  ArrowRight,
  Headset,
  Users,
  ChartNoAxesColumnIncreasing,
  ShieldCheck,
  Sparkles,
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: Headset,
      title: 'Ticket Management',
      description: 'Create, track and resolve support requests.',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Keep your team connected and aligned.',
    },
    {
      icon: ChartNoAxesColumnIncreasing,
      title: 'Live Insights',
      description: 'Monitor performance and resolution trends.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure Workspace',
      description: 'Keep your workspace safe and organized.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }

      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.details?.[0]?.message || err.message);
      } else {
        setError('Unable to reach server. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell sand-auth">
      {/* Left showcase */}
      <section className="auth-showcase sand-showcase">
        <div className="showcase-decoration decoration-one" />
        <div className="showcase-decoration decoration-two" />

        <div className="sand-showcase-inner">
          <header className="sand-brand">
            <div className="sand-brand-mark">RD</div>
            <span>RelayDesk</span>
          </header>

          <div className="sand-intro">
            <div className="sand-eyebrow">
              <Sparkles size={14} />
              SMART SUPPORT MANAGEMENT
            </div>

            <h1 className="sand-headline">
              Better Support.
              <br />
              <span>Stronger Connections.</span>
            </h1>

            <p className="sand-lead">
              A smarter way to manage customer requests,
              simplify team collaboration and resolve
              issues faster.
            </p>
          </div>

          <div className="sand-features-heading">
            Everything in one workspace
          </div>

          <div className="sand-features">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="sand-feature" key={feature.title}>
                  <div className="sand-feature-icon">
                    <Icon size={21} />
                  </div>

                  <div className="sand-feature-content">
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="sand-footer">
          <span>One workspace. Better support.</span>
          <span>© RelayDesk</span>
        </footer>
      </section>

      {/* Right authentication */}
      <section className="auth-form-pane sand-form-pane">
        <div className="auth-card sand-auth-card">
          <div className="sand-card-heading">
            <span className="sand-card-icon">
              <Shield size={19} />
            </span>
            <span>Secure workspace access</span>
          </div>

          <div className="segmented-tabs sand-tabs">
            <button
              type="button"
              className={`seg-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Sign In
            </button>

            <button
              type="button"
              className={`seg-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Create Account
            </button>
          </div>

          <div className="sand-welcome">
            <span className="sand-welcome-label">
              {mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}
            </span>

            <h2>
              {mode === 'login' ? 'Welcome back!' : 'Join RelayDesk'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Sign in to continue to your workspace.'
                : 'Create your account and simplify support.'}
            </p>
          </div>

          {error && (
            <div className="alert-error sand-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group sand-form-group">
                <label className="form-label" htmlFor="auth-name">
                  Full Name
                </label>

                <input
                  id="auth-name"
                  className="input sand-input"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group sand-form-group">
              <label className="form-label" htmlFor="auth-email">
                Email Address
              </label>

              <input
                id="auth-email"
                type="email"
                className="input sand-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group sand-form-group">
              <label className="form-label" htmlFor="auth-password">
                Password
              </label>

              <input
                id="auth-password"
                type="password"
                className="input sand-input"
                placeholder={
                  mode === 'register'
                    ? 'Minimum 8 characters'
                    : 'Enter your password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : 1}
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
              />
            </div>

            <div className="sand-form-meta">
              <ShieldCheck size={15} />
              Your information is securely protected
            </div>

            <button
              type="submit"
              className="btn btn-primary sand-submit"
              disabled={submitting}
            >
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In to Workspace'
                  : 'Create My Account'}

              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="sand-card-footer">
            Thoughtfully designed for better support.
          </div>
        </div>
      </section>
    </main>
  );
}
