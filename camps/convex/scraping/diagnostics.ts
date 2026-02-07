import { query } from '../_generated/server';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';

/**
 * Get comprehensive pipeline diagnostics for a city
 * Shows the status at each stage of the data pipeline
 */
export const getPipelineDiagnostics = query({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      return null;
    }

    // Get all organizations that include this city
    const allOrganizations = await ctx.db.query('organizations').collect();
    const orgsInCity = allOrganizations.filter((org) => org.cityIds.includes(args.cityId));
    const activeOrgsInCity = orgsInCity.filter((org) => org.isActive);
    const orgIdsInCity = new Set(orgsInCity.map((o) => o._id));

    // Get sources for this city
    const sourcesInCity = await ctx.db
      .query('scrapeSources')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    const activeSources = sourcesInCity.filter((s) => s.isActive);
    const healthySources = sourcesInCity.filter((s) => s.isActive && s.scraperHealth.consecutiveFailures < 3);
    const failingSources = sourcesInCity.filter((s) => s.scraperHealth.consecutiveFailures >= 3);
    const sourcesNeedingRegeneration = sourcesInCity.filter((s) => s.scraperHealth.needsRegeneration);
    const closedSources = sourcesInCity.filter((s) => s.closureReason);

    // Get sessions in this city
    const sessionsInCity = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId))
      .collect();

    // Group sessions by status
    const sessionsByStatus = {
      active: sessionsInCity.filter((s) => s.status === 'active'),
      draft: sessionsInCity.filter((s) => s.status === 'draft'),
      sold_out: sessionsInCity.filter((s) => s.status === 'sold_out'),
      cancelled: sessionsInCity.filter((s) => s.status === 'cancelled'),
      completed: sessionsInCity.filter((s) => s.status === 'completed'),
    };

    // Get camps from organizations in this city
    const allCamps = await ctx.db.query('camps').collect();
    const campsInCity = allCamps.filter((c) => orgIdsInCity.has(c.organizationId));
    const activeCampsInCity = campsInCity.filter((c) => c.isActive);

    // Group camps by whether they have sessions
    const campIdsWithSessions = new Set(sessionsInCity.map((s) => s.campId));
    const campsWithSessions = campsInCity.filter((c) => campIdsWithSessions.has(c._id));
    const campsWithoutSessions = campsInCity.filter((c) => !campIdsWithSessions.has(c._id));

    // Get pending sessions from sources in this city
    const sourceIdsInCity = new Set(sourcesInCity.map((s) => s._id));
    const allPendingSessions = await ctx.db
      .query('pendingSessions')
      .withIndex('by_status', (q) => q.eq('status', 'pending_review'))
      .collect();
    const pendingSessionsInCity = allPendingSessions.filter((p) => sourceIdsInCity.has(p.sourceId));

    // Get recent jobs for sources in this city
    const recentJobs = await ctx.db.query('scrapeJobs').order('desc').take(500);
    const jobsInCity = recentJobs.filter((j) => sourceIdsInCity.has(j.sourceId));
    const recentJobsInCity = jobsInCity.slice(0, 50);

    // Group jobs by status
    const jobsByStatus = {
      pending: recentJobsInCity.filter((j) => j.status === 'pending'),
      running: recentJobsInCity.filter((j) => j.status === 'running'),
      completed: recentJobsInCity.filter((j) => j.status === 'completed'),
      failed: recentJobsInCity.filter((j) => j.status === 'failed'),
    };

    // Get scraper development requests for this city
    const devRequests = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();
    const activeDevRequests = devRequests.filter(
      (r) =>
        r.status === 'pending' || r.status === 'in_progress' || r.status === 'testing' || r.status === 'needs_feedback',
    );

    // Calculate completeness distribution
    const sessionsWithCompleteness = sessionsInCity.filter((s) => s.completenessScore !== undefined);
    const completenessDistribution = {
      high: sessionsWithCompleteness.filter((s) => s.completenessScore! >= 80).length,
      medium: sessionsWithCompleteness.filter((s) => s.completenessScore! >= 50 && s.completenessScore! < 80).length,
      low: sessionsWithCompleteness.filter((s) => s.completenessScore! < 50).length,
    };

    // Get locations in this city
    const locationsInCity = await ctx.db
      .query('locations')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    // Get discovered sources pending review
    const discoveredSources = await ctx.db
      .query('discoveredSources')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'pending_review'))
      .collect();

    // Identify issues
    const issues: { severity: 'error' | 'warning' | 'info'; message: string; count?: number }[] = [];

    if (!city.isActive) {
      issues.push({
        severity: 'error',
        message: "City is marked as INACTIVE - it won't appear in city filters",
      });
    }

    if (orgsInCity.length === 0) {
      issues.push({
        severity: 'error',
        message: 'No organizations have this city in their cityIds array',
      });
    } else if (activeOrgsInCity.length === 0) {
      issues.push({
        severity: 'error',
        message: 'All organizations in this city are inactive',
        count: orgsInCity.length,
      });
    }

    if (sourcesInCity.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'No scrape sources configured for this city',
      });
    } else if (activeSources.length === 0) {
      issues.push({
        severity: 'error',
        message: 'All scrape sources are inactive',
        count: sourcesInCity.length,
      });
    }

    if (failingSources.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${failingSources.length} sources are failing (3+ consecutive failures)`,
        count: failingSources.length,
      });
    }

    if (sourcesNeedingRegeneration.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${sourcesNeedingRegeneration.length} sources need scraper regeneration`,
        count: sourcesNeedingRegeneration.length,
      });
    }

    if (sessionsByStatus.active.length === 0 && sessionsInCity.length > 0) {
      issues.push({
        severity: 'error',
        message: `No ACTIVE sessions - all ${sessionsInCity.length} sessions are in other statuses`,
      });
    }

    if (sessionsByStatus.draft.length > sessionsByStatus.active.length) {
      issues.push({
        severity: 'warning',
        message: `More draft sessions (${sessionsByStatus.draft.length}) than active sessions (${sessionsByStatus.active.length})`,
      });
    }

    if (pendingSessionsInCity.length > 0) {
      issues.push({
        severity: 'info',
        message: `${pendingSessionsInCity.length} sessions pending review`,
        count: pendingSessionsInCity.length,
      });
    }

    if (campsWithoutSessions.length > campsWithSessions.length) {
      issues.push({
        severity: 'info',
        message: `${campsWithoutSessions.length} camps have no sessions`,
        count: campsWithoutSessions.length,
      });
    }

    // Top sources by session count
    const sourceSessionCounts = new Map<string, number>();
    for (const session of sessionsInCity) {
      if (session.sourceId) {
        sourceSessionCounts.set(session.sourceId, (sourceSessionCounts.get(session.sourceId) || 0) + 1);
      }
    }

    const topSources = sourcesInCity
      .map((source) => ({
        _id: source._id,
        name: source.name,
        url: source.url,
        isActive: source.isActive,
        sessionCount: source.sessionCount ?? 0,
        activeSessionCount: source.activeSessionCount ?? 0,
        health: source.scraperHealth,
        lastScrapedAt: source.lastScrapedAt,
        closureReason: source.closureReason,
      }))
      .sort((a, b) => (b.sessionCount ?? 0) - (a.sessionCount ?? 0))
      .slice(0, 20);

    // Sessions without sources (orphaned)
    const sessionsWithoutSource = sessionsInCity.filter((s) => !s.sourceId);

    return {
      city: {
        _id: city._id,
        name: city.name,
        slug: city.slug,
        isActive: city.isActive,
      },
      pipeline: {
        organizations: {
          total: orgsInCity.length,
          active: activeOrgsInCity.length,
          inactive: orgsInCity.length - activeOrgsInCity.length,
        },
        sources: {
          total: sourcesInCity.length,
          active: activeSources.length,
          healthy: healthySources.length,
          failing: failingSources.length,
          needsRegeneration: sourcesNeedingRegeneration.length,
          closed: closedSources.length,
        },
        camps: {
          total: campsInCity.length,
          active: activeCampsInCity.length,
          withSessions: campsWithSessions.length,
          withoutSessions: campsWithoutSessions.length,
        },
        sessions: {
          total: sessionsInCity.length,
          byStatus: {
            active: sessionsByStatus.active.length,
            draft: sessionsByStatus.draft.length,
            sold_out: sessionsByStatus.sold_out.length,
            cancelled: sessionsByStatus.cancelled.length,
            completed: sessionsByStatus.completed.length,
          },
          completeness: completenessDistribution,
          orphaned: sessionsWithoutSource.length,
        },
        locations: {
          total: locationsInCity.length,
        },
        pendingSessions: pendingSessionsInCity.length,
        discoveredSources: discoveredSources.length,
        devRequests: activeDevRequests.length,
      },
      recentJobs: {
        total: recentJobsInCity.length,
        byStatus: {
          pending: jobsByStatus.pending.length,
          running: jobsByStatus.running.length,
          completed: jobsByStatus.completed.length,
          failed: jobsByStatus.failed.length,
        },
      },
      issues,
      topSources,
    };
  },
});

/**
 * List all cities with basic pipeline stats
 */
export const listCitiesWithStats = query({
  args: {},
  handler: async (ctx) => {
    const cities = await ctx.db.query('cities').collect();

    // Get all sessions and group by city
    const allSessions = await ctx.db.query('sessions').collect();
    const sessionsByCity = new Map<string, typeof allSessions>();
    for (const session of allSessions) {
      const existing = sessionsByCity.get(session.cityId) || [];
      existing.push(session);
      sessionsByCity.set(session.cityId, existing);
    }

    // Get all sources and group by city
    const allSources = await ctx.db.query('scrapeSources').collect();
    const sourcesByCity = new Map<string, typeof allSources>();
    for (const source of allSources) {
      const existing = sourcesByCity.get(source.cityId) || [];
      existing.push(source);
      sourcesByCity.set(source.cityId, existing);
    }

    // Get all organizations
    const allOrgs = await ctx.db.query('organizations').collect();

    return cities
      .map((city) => {
        const sessions = sessionsByCity.get(city._id) || [];
        const sources = sourcesByCity.get(city._id) || [];
        const orgsInCity = allOrgs.filter((org) => org.cityIds.includes(city._id));

        const activeSessions = sessions.filter((s) => s.status === 'active');
        const activeSources = sources.filter((s) => s.isActive);
        const failingSources = sources.filter((s) => s.scraperHealth.consecutiveFailures >= 3);

        return {
          _id: city._id,
          name: city.name,
          slug: city.slug,
          state: city.state,
          isActive: city.isActive,
          stats: {
            organizations: orgsInCity.length,
            sources: sources.length,
            activeSources: activeSources.length,
            failingSources: failingSources.length,
            sessions: sessions.length,
            activeSessions: activeSessions.length,
          },
        };
      })
      .sort((a, b) => b.stats.sessions - a.stats.sessions);
  },
});

/**
 * Get sessions breakdown for a city with grouping options
 */
export const getSessionsBreakdown = query({
  args: {
    cityId: v.id('cities'),
    groupBy: v.union(v.literal('status'), v.literal('source'), v.literal('organization'), v.literal('completeness')),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId))
      .collect();

    if (args.groupBy === 'status') {
      const byStatus: Record<string, typeof sessions> = {
        active: [],
        draft: [],
        sold_out: [],
        cancelled: [],
        completed: [],
      };
      for (const session of sessions) {
        byStatus[session.status]?.push(session);
      }
      return Object.entries(byStatus).map(([status, sessions]) => ({
        key: status,
        count: sessions.length,
        sessions: sessions.slice(0, 5).map((s) => ({
          _id: s._id,
          campName: s.campName,
          startDate: s.startDate,
          completenessScore: s.completenessScore,
        })),
      }));
    }

    if (args.groupBy === 'source') {
      const bySource = new Map<string, typeof sessions>();
      const noSource: typeof sessions = [];
      for (const session of sessions) {
        if (session.sourceId) {
          const existing = bySource.get(session.sourceId) || [];
          existing.push(session);
          bySource.set(session.sourceId, existing);
        } else {
          noSource.push(session);
        }
      }

      // Get source names
      const sourceIds = Array.from(bySource.keys()) as Id<'scrapeSources'>[];
      const sources = await Promise.all(sourceIds.map((id) => ctx.db.get(id)));
      const sourceMap = new Map(
        sources.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => [s._id as string, s.name]),
      );

      const result = Array.from(bySource.entries())
        .map(([sourceId, sessions]) => ({
          key: sourceMap.get(sourceId as any) || sourceId,
          sourceId,
          count: sessions.length,
          activeCount: sessions.filter((s) => s.status === 'active').length,
        }))
        .sort((a, b) => b.count - a.count);

      if (noSource.length > 0) {
        result.push({
          key: '(No source)',
          sourceId: '',
          count: noSource.length,
          activeCount: noSource.filter((s) => s.status === 'active').length,
        });
      }

      return result;
    }

    if (args.groupBy === 'organization') {
      const byOrg = new Map<string, typeof sessions>();
      for (const session of sessions) {
        const existing = byOrg.get(session.organizationId) || [];
        existing.push(session);
        byOrg.set(session.organizationId, existing);
      }

      // Get org names
      const orgIds = Array.from(byOrg.keys()) as Id<'organizations'>[];
      const orgs = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
      const orgMap = new Map(
        orgs.filter((o): o is NonNullable<typeof o> => o !== null).map((o) => [o._id as string, o.name]),
      );

      return Array.from(byOrg.entries())
        .map(([orgId, sessions]) => ({
          key: orgMap.get(orgId as any) || orgId,
          orgId,
          count: sessions.length,
          activeCount: sessions.filter((s) => s.status === 'active').length,
        }))
        .sort((a, b) => b.count - a.count);
    }

    if (args.groupBy === 'completeness') {
      const buckets = {
        '100%': sessions.filter((s) => s.completenessScore === 100),
        '80-99%': sessions.filter(
          (s) => s.completenessScore !== undefined && s.completenessScore >= 80 && s.completenessScore < 100,
        ),
        '50-79%': sessions.filter(
          (s) => s.completenessScore !== undefined && s.completenessScore >= 50 && s.completenessScore < 80,
        ),
        '<50%': sessions.filter((s) => s.completenessScore !== undefined && s.completenessScore < 50),
        'Unknown': sessions.filter((s) => s.completenessScore === undefined),
      };

      return Object.entries(buckets).map(([key, sessions]) => ({
        key,
        count: sessions.length,
        activeCount: sessions.filter((s) => s.status === 'active').length,
      }));
    }

    return [];
  },
});
