'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export default function AlertsManagementPage() {
  const { user } = useAuth();

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

  return <AlertsManagementContent />;
}

function AlertsManagementContent() {
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [acknowledgingAlert, setAcknowledgingAlert] = useState<Id<'scraperAlerts'> | null>(null);

  // Fetch unacknowledged alerts
  const alerts = useQuery(api.scraping.queries.listUnacknowledgedAlerts, {});

  // Mutation for acknowledging alerts
  const acknowledgeAlert = useMutation(api.scraping.mutations.acknowledgeAlert);

  const handleAcknowledge = async (alertId: Id<'scraperAlerts'>) => {
    try {
      setAcknowledgingAlert(alertId);
      await acknowledgeAlert({
        alertId,
        acknowledgedBy: 'admin',
      });
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    } finally {
      setAcknowledgingAlert(null);
    }
  };

  // Filter alerts by severity
  const filteredAlerts =
    alerts?.filter((alert) =>
      severityFilter === 'all' ? true : alert.severity === severityFilter
    ) ?? [];

  // Group alerts by severity for stats
  const alertStats = {
    critical: alerts?.filter((a) => a.severity === 'critical').length ?? 0,
    error: alerts?.filter((a) => a.severity === 'error').length ?? 0,
    warning: alerts?.filter((a) => a.severity === 'warning').length ?? 0,
    info: alerts?.filter((a) => a.severity === 'info').length ?? 0,
  };

  const severityFilters: Array<{ value: AlertSeverity | 'all'; label: string; count?: number }> = [
    { value: 'all', label: 'All', count: alerts?.length },
    { value: 'critical', label: 'Critical', count: alertStats.critical },
    { value: 'error', label: 'Error', count: alertStats.error },
    { value: 'warning', label: 'Warning', count: alertStats.warning },
    { value: 'info', label: 'Info', count: alertStats.info },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-700 mb-1 block">
                &larr; Back to Admin
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                System Alerts
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                View and acknowledge system alerts
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Alert Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <p className="text-sm text-slate-600 dark:text-slate-400">Critical</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {alertStats.critical}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
            <p className="text-sm text-slate-600 dark:text-slate-400">Error</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {alertStats.error}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-slate-600 dark:text-slate-400">Warning</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {alertStats.warning}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <p className="text-sm text-slate-600 dark:text-slate-400">Info</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {alertStats.info}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">
              Severity:
            </span>
            {severityFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setSeverityFilter(filter.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  severityFilter === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {filter.label}
                {filter.count !== undefined && filter.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded ${
                      severityFilter === filter.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {alerts === undefined && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <div className="p-6 animate-pulse space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {alerts !== undefined && filteredAlerts.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center">
            <div className="text-green-500 mb-4">
              <CheckCircleIcon />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {severityFilter === 'all' ? 'No unacknowledged alerts' : `No ${severityFilter} alerts`}
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {severityFilter === 'all'
                ? 'All alerts have been acknowledged. The system is running smoothly.'
                : `There are no unacknowledged alerts with ${severityFilter} severity.`}
            </p>
          </div>
        )}

        {/* Alerts List */}
        {alerts !== undefined && filteredAlerts.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm divide-y divide-slate-200 dark:divide-slate-700">
            {filteredAlerts.map((alert) => (
              <div
                key={alert._id}
                className={`p-6 ${getSeverityBgClass(alert.severity)}`}
              >
                <div className="flex items-start gap-4">
                  {/* Severity Icon */}
                  <div className={`flex-shrink-0 mt-0.5 ${getSeverityIconColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity)}
                  </div>

                  {/* Alert Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium uppercase rounded ${getSeverityBadgeClass(
                          alert.severity
                        )}`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {alert.alertType.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-slate-900 dark:text-white mb-2">{alert.message}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <ClockIcon />
                        {formatTimestamp(alert.createdAt)}
                      </span>
                      {alert.source && (
                        <span className="flex items-center gap-1">
                          <DatabaseIcon />
                          {alert.source.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acknowledge Button */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleAcknowledge(alert._id)}
                      disabled={acknowledgingAlert === alert._id}
                      className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
                        acknowledgingAlert === alert._id
                          ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      {acknowledgingAlert === alert._id ? (
                        <>
                          <SpinnerIcon />
                          Acknowledging...
                        </>
                      ) : (
                        <>
                          <CheckIcon />
                          Acknowledge
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
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
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getSeverityBgClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-900/10';
    case 'error':
      return 'bg-orange-50 dark:bg-orange-900/10';
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-900/10';
    default:
      return '';
  }
}

function getSeverityIconColor(severity: string): string {
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

function getSeverityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    case 'error':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    default:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
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
function AlertCircleIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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

function CheckCircleIcon() {
  return (
    <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
