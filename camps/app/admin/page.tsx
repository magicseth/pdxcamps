'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

export default function AdminDashboard() {
  const { user } = useAuth();

  // Simple auth check - just verify user exists
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Admin Access Required
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Please sign in to access the admin dashboard.
          </p>
          <a
            href="/sign-in"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return <AdminDashboardContent />;
}

function AdminDashboardContent() {
  // Fetch scrape sources for stats
  const scrapeSources = useQuery(api.scraping.queries.listScrapeSources, {});
  const alerts = useQuery(api.scraping.queries.listUnacknowledgedAlerts, {});

  // Calculate stats
  const totalSources = scrapeSources?.length ?? 0;
  const activeSources = scrapeSources?.filter((s) => s.isActive).length ?? 0;
  const unhealthySources =
    scrapeSources?.filter(
      (s) => s.scraperHealth.consecutiveFailures >= 3 || s.scraperHealth.needsRegeneration
    ).length ?? 0;

  const alertCount = alerts?.length ?? 0;
  const criticalAlerts = alerts?.filter((a) => a.severity === 'critical').length ?? 0;
  const errorAlerts = alerts?.filter((a) => a.severity === 'error').length ?? 0;
  const warningAlerts = alerts?.filter((a) => a.severity === 'warning').length ?? 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 mb-1 block">
                &larr; Back to Site
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Admin Dashboard
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Scrape Sources"
            value={totalSources}
            subtitle={`${activeSources} active`}
            icon={<DatabaseIcon />}
            color="blue"
          />
          <StatsCard
            title="Unhealthy Scrapers"
            value={unhealthySources}
            subtitle="Need attention"
            icon={<AlertTriangleIcon />}
            color={unhealthySources > 0 ? 'red' : 'green'}
          />
          <StatsCard
            title="Active Alerts"
            value={alertCount}
            subtitle={`${criticalAlerts} critical, ${errorAlerts} errors`}
            icon={<BellIcon />}
            color={criticalAlerts > 0 ? 'red' : alertCount > 0 ? 'yellow' : 'green'}
          />
          <StatsCard
            title="Warning Alerts"
            value={warningAlerts}
            subtitle="Warnings pending"
            icon={<InfoIcon />}
            color={warningAlerts > 0 ? 'yellow' : 'green'}
          />
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <QuickLink
            href="/admin/discovery"
            title="Discovery Queue"
            description="Review and approve newly discovered camp sources"
            icon={<SearchIcon />}
          />
          <QuickLink
            href="/admin/sources"
            title="Scrape Sources"
            description="Manage scraping configurations and monitor health"
            icon={<DatabaseIcon />}
          />
          <QuickLink
            href="/admin/alerts"
            title="Alerts"
            description="View and acknowledge system alerts"
            icon={<BellIcon />}
          />
        </div>

        {/* Recent Alerts */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Recent Alerts
            </h2>
            <Link
              href="/admin/alerts"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all &rarr;
            </Link>
          </div>

          {alerts === undefined ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-slate-400 mb-2">
                <CheckCircleIcon />
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                No unacknowledged alerts
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert._id}
                  className="px-6 py-4 flex items-start gap-4"
                >
                  <div className={`flex-shrink-0 mt-0.5 ${getSeverityColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium uppercase ${getSeverityBadgeColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {alert.alertType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {alert.message}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {formatTimestamp(alert.createdAt)}
                      {alert.source && ` - ${alert.source.name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// Quick Link Component
function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}

// Helper functions
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-red-600 dark:text-red-400';
    case 'error':
      return 'text-orange-600 dark:text-orange-400';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
}

function getSeverityBadgeColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50 px-2 py-0.5 rounded';
    case 'error':
      return 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/50 px-2 py-0.5 rounded';
    case 'warning':
      return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/50 px-2 py-0.5 rounded';
    default:
      return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50 px-2 py-0.5 rounded';
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical':
    case 'error':
      return <AlertCircleIcon />;
    case 'warning':
      return <AlertTriangleIcon />;
    default:
      return <InfoIcon />;
  }
}

// Icons
function DatabaseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
