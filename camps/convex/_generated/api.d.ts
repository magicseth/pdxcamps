/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_migrations from "../admin/migrations.js";
import type * as admin_mutations from "../admin/mutations.js";
import type * as admin_queries from "../admin/queries.js";
import type * as blog_actions from "../blog/actions.js";
import type * as blog_dataQueries from "../blog/dataQueries.js";
import type * as blog_mutations from "../blog/mutations.js";
import type * as blog_queries from "../blog/queries.js";
import type * as calendar_queries from "../calendar/queries.js";
import type * as campRequests_actions from "../campRequests/actions.js";
import type * as campRequests_mutations from "../campRequests/mutations.js";
import type * as campRequests_queries from "../campRequests/queries.js";
import type * as camps_mutations from "../camps/mutations.js";
import type * as camps_queries from "../camps/queries.js";
import type * as children_mutations from "../children/mutations.js";
import type * as children_queries from "../children/queries.js";
import type * as churn_mutations from "../churn/mutations.js";
import type * as churn_queries from "../churn/queries.js";
import type * as churn_winback from "../churn/winback.js";
import type * as churn_winbackWorkflow from "../churn/winbackWorkflow.js";
import type * as cities_actions from "../cities/actions.js";
import type * as cities_mutations from "../cities/mutations.js";
import type * as cities_queries from "../cities/queries.js";
import type * as cleanup from "../cleanup.js";
import type * as cleanup_campDedup from "../cleanup/campDedup.js";
import type * as cleanup_categorize from "../cleanup/categorize.js";
import type * as cleanup_locations from "../cleanup/locations.js";
import type * as cleanup_organizations from "../cleanup/organizations.js";
import type * as cleanup_priceFixes from "../cleanup/priceFixes.js";
import type * as cleanup_reports from "../cleanup/reports.js";
import type * as cleanup_sessions from "../cleanup/sessions.js";
import type * as crons from "../crons.js";
import type * as customCamps_mutations from "../customCamps/mutations.js";
import type * as customCamps_queries from "../customCamps/queries.js";
import type * as discovery_actions from "../discovery/actions.js";
import type * as discovery_mutations from "../discovery/mutations.js";
import type * as discovery_queries from "../discovery/queries.js";
import type * as email from "../email.js";
import type * as emailAutomation_actions from "../emailAutomation/actions.js";
import type * as emailAutomation_behavioralTriggers from "../emailAutomation/behavioralTriggers.js";
import type * as emailAutomation_emailSendActions from "../emailAutomation/emailSendActions.js";
import type * as emailAutomation_mutations from "../emailAutomation/mutations.js";
import type * as emailAutomation_queries from "../emailAutomation/queries.js";
import type * as emailAutomation_triggerPaywallNudge from "../emailAutomation/triggerPaywallNudge.js";
import type * as emailAutomation_workflows from "../emailAutomation/workflows.js";
import type * as emailForward from "../emailForward.js";
import type * as expansion_actions from "../expansion/actions.js";
import type * as expansion_domainWorkflow from "../expansion/domainWorkflow.js";
import type * as expansion_iconGeneration from "../expansion/iconGeneration.js";
import type * as expansion_iconMutations from "../expansion/iconMutations.js";
import type * as expansion_launchWorkflow from "../expansion/launchWorkflow.js";
import type * as expansion_mutations from "../expansion/mutations.js";
import type * as expansion_queries from "../expansion/queries.js";
import type * as families_mutations from "../families/mutations.js";
import type * as families_queries from "../families/queries.js";
import type * as featured_mutations from "../featured/mutations.js";
import type * as featured_queries from "../featured/queries.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as leads_actions from "../leads/actions.js";
import type * as leads_mutations from "../leads/mutations.js";
import type * as leads_queries from "../leads/queries.js";
import type * as leads_workflows from "../leads/workflows.js";
import type * as lib_adminAuth from "../lib/adminAuth.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_geocoding from "../lib/geocoding.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_paywall from "../lib/paywall.js";
import type * as lib_sessionAggregate from "../lib/sessionAggregate.js";
import type * as lib_validators from "../lib/validators.js";
import type * as locations_mutations from "../locations/mutations.js";
import type * as locations_queries from "../locations/queries.js";
import type * as notifications_actions from "../notifications/actions.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as notifications_queries from "../notifications/queries.js";
import type * as orgDashboard_actions from "../orgDashboard/actions.js";
import type * as orgDashboard_mutations from "../orgDashboard/mutations.js";
import type * as orgDashboard_queries from "../orgDashboard/queries.js";
import type * as orgOutreach_actions from "../orgOutreach/actions.js";
import type * as orgOutreach_mutations from "../orgOutreach/mutations.js";
import type * as orgOutreach_queries from "../orgOutreach/queries.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as partners_admin from "../partners/admin.js";
import type * as partners_commissions from "../partners/commissions.js";
import type * as partners_internals from "../partners/internals.js";
import type * as partners_mutations from "../partners/mutations.js";
import type * as partners_notifications from "../partners/notifications.js";
import type * as partners_queries from "../partners/queries.js";
import type * as planner_aggregates from "../planner/aggregates.js";
import type * as planner_mutations from "../planner/mutations.js";
import type * as planner_queries from "../planner/queries.js";
import type * as referrals_actions from "../referrals/actions.js";
import type * as referrals_internal from "../referrals/internal.js";
import type * as referrals_mutations from "../referrals/mutations.js";
import type * as referrals_queries from "../referrals/queries.js";
import type * as registrations_mutations from "../registrations/mutations.js";
import type * as registrations_queries from "../registrations/queries.js";
import type * as reviews_mutations from "../reviews/mutations.js";
import type * as reviews_queries from "../reviews/queries.js";
import type * as scraping_actions from "../scraping/actions.js";
import type * as scraping_contactExtractor from "../scraping/contactExtractor.js";
import type * as scraping_contactExtractorHelpers from "../scraping/contactExtractorHelpers.js";
import type * as scraping_coverage from "../scraping/coverage.js";
import type * as scraping_dailyReport from "../scraping/dailyReport.js";
import type * as scraping_dailyReportQueries from "../scraping/dailyReportQueries.js";
import type * as scraping_data from "../scraping/data.js";
import type * as scraping_dataQualityActions from "../scraping/dataQualityActions.js";
import type * as scraping_dataQualityChecks from "../scraping/dataQualityChecks.js";
import type * as scraping_debug from "../scraping/debug.js";
import type * as scraping_deduplication from "../scraping/deduplication.js";
import type * as scraping_development from "../scraping/development.js";
import type * as scraping_diagnostics from "../scraping/diagnostics.js";
import type * as scraping_directories from "../scraping/directories.js";
import type * as scraping_directoryDaemon from "../scraping/directoryDaemon.js";
import type * as scraping_directoryDaemonActions from "../scraping/directoryDaemonActions.js";
import type * as scraping_discoveryAction from "../scraping/discoveryAction.js";
import type * as scraping_falCreditCheck from "../scraping/falCreditCheck.js";
import type * as scraping_falCreditQueries from "../scraping/falCreditQueries.js";
import type * as scraping_fixOrgWebsites from "../scraping/fixOrgWebsites.js";
import type * as scraping_generateImages from "../scraping/generateImages.js";
import type * as scraping_imageWorkflow from "../scraping/imageWorkflow.js";
import type * as scraping_images from "../scraping/images.js";
import type * as scraping_import from "../scraping/import.js";
import type * as scraping_importMutations from "../scraping/importMutations.js";
import type * as scraping_internal from "../scraping/internal.js";
import type * as scraping_jobs from "../scraping/jobs.js";
import type * as scraping_marketDiscovery from "../scraping/marketDiscovery.js";
import type * as scraping_marketDiscoveryAction from "../scraping/marketDiscoveryAction.js";
import type * as scraping_marketSeeding from "../scraping/marketSeeding.js";
import type * as scraping_mutations from "../scraping/mutations.js";
import type * as scraping_newDirectoryActions from "../scraping/newDirectoryActions.js";
import type * as scraping_omsi from "../scraping/omsi.js";
import type * as scraping_pipelineOrchestrator from "../scraping/pipelineOrchestrator.js";
import type * as scraping_populateCampImages from "../scraping/populateCampImages.js";
import type * as scraping_populateOrgLogos from "../scraping/populateOrgLogos.js";
import type * as scraping_queries from "../scraping/queries.js";
import type * as scraping_refreshTrackersImages from "../scraping/refreshTrackersImages.js";
import type * as scraping_scrapeWorkflow from "../scraping/scrapeWorkflow.js";
import type * as scraping_scraperAutomation from "../scraping/scraperAutomation.js";
import type * as scraping_scraperCodeValidation from "../scraping/scraperCodeValidation.js";
import type * as scraping_scraperConfig from "../scraping/scraperConfig.js";
import type * as scraping_scrapers_executor from "../scraping/scrapers/executor.js";
import type * as scraping_scrapers_omsi from "../scraping/scrapers/omsi.js";
import type * as scraping_scrapers_types from "../scraping/scrapers/types.js";
import type * as scraping_seedAdditionalSources from "../scraping/seedAdditionalSources.js";
import type * as scraping_seedSources from "../scraping/seedSources.js";
import type * as scraping_sourceRecovery from "../scraping/sourceRecovery.js";
import type * as scraping_sources from "../scraping/sources.js";
import type * as scraping_urlDiscovery from "../scraping/urlDiscovery.js";
import type * as scraping_validation from "../scraping/validation.js";
import type * as seed from "../seed.js";
import type * as sessions_mutations from "../sessions/mutations.js";
import type * as sessions_queries from "../sessions/queries.js";
import type * as sessions_seoQueries from "../sessions/seoQueries.js";
import type * as share_queries from "../share/queries.js";
import type * as social_mutations from "../social/mutations.js";
import type * as social_queries from "../social/queries.js";
import type * as subscriptions from "../subscriptions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/migrations": typeof admin_migrations;
  "admin/mutations": typeof admin_mutations;
  "admin/queries": typeof admin_queries;
  "blog/actions": typeof blog_actions;
  "blog/dataQueries": typeof blog_dataQueries;
  "blog/mutations": typeof blog_mutations;
  "blog/queries": typeof blog_queries;
  "calendar/queries": typeof calendar_queries;
  "campRequests/actions": typeof campRequests_actions;
  "campRequests/mutations": typeof campRequests_mutations;
  "campRequests/queries": typeof campRequests_queries;
  "camps/mutations": typeof camps_mutations;
  "camps/queries": typeof camps_queries;
  "children/mutations": typeof children_mutations;
  "children/queries": typeof children_queries;
  "churn/mutations": typeof churn_mutations;
  "churn/queries": typeof churn_queries;
  "churn/winback": typeof churn_winback;
  "churn/winbackWorkflow": typeof churn_winbackWorkflow;
  "cities/actions": typeof cities_actions;
  "cities/mutations": typeof cities_mutations;
  "cities/queries": typeof cities_queries;
  cleanup: typeof cleanup;
  "cleanup/campDedup": typeof cleanup_campDedup;
  "cleanup/categorize": typeof cleanup_categorize;
  "cleanup/locations": typeof cleanup_locations;
  "cleanup/organizations": typeof cleanup_organizations;
  "cleanup/priceFixes": typeof cleanup_priceFixes;
  "cleanup/reports": typeof cleanup_reports;
  "cleanup/sessions": typeof cleanup_sessions;
  crons: typeof crons;
  "customCamps/mutations": typeof customCamps_mutations;
  "customCamps/queries": typeof customCamps_queries;
  "discovery/actions": typeof discovery_actions;
  "discovery/mutations": typeof discovery_mutations;
  "discovery/queries": typeof discovery_queries;
  email: typeof email;
  "emailAutomation/actions": typeof emailAutomation_actions;
  "emailAutomation/behavioralTriggers": typeof emailAutomation_behavioralTriggers;
  "emailAutomation/emailSendActions": typeof emailAutomation_emailSendActions;
  "emailAutomation/mutations": typeof emailAutomation_mutations;
  "emailAutomation/queries": typeof emailAutomation_queries;
  "emailAutomation/triggerPaywallNudge": typeof emailAutomation_triggerPaywallNudge;
  "emailAutomation/workflows": typeof emailAutomation_workflows;
  emailForward: typeof emailForward;
  "expansion/actions": typeof expansion_actions;
  "expansion/domainWorkflow": typeof expansion_domainWorkflow;
  "expansion/iconGeneration": typeof expansion_iconGeneration;
  "expansion/iconMutations": typeof expansion_iconMutations;
  "expansion/launchWorkflow": typeof expansion_launchWorkflow;
  "expansion/mutations": typeof expansion_mutations;
  "expansion/queries": typeof expansion_queries;
  "families/mutations": typeof families_mutations;
  "families/queries": typeof families_queries;
  "featured/mutations": typeof featured_mutations;
  "featured/queries": typeof featured_queries;
  feedback: typeof feedback;
  http: typeof http;
  "leads/actions": typeof leads_actions;
  "leads/mutations": typeof leads_mutations;
  "leads/queries": typeof leads_queries;
  "leads/workflows": typeof leads_workflows;
  "lib/adminAuth": typeof lib_adminAuth;
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/geocoding": typeof lib_geocoding;
  "lib/helpers": typeof lib_helpers;
  "lib/paywall": typeof lib_paywall;
  "lib/sessionAggregate": typeof lib_sessionAggregate;
  "lib/validators": typeof lib_validators;
  "locations/mutations": typeof locations_mutations;
  "locations/queries": typeof locations_queries;
  "notifications/actions": typeof notifications_actions;
  "notifications/mutations": typeof notifications_mutations;
  "notifications/queries": typeof notifications_queries;
  "orgDashboard/actions": typeof orgDashboard_actions;
  "orgDashboard/mutations": typeof orgDashboard_mutations;
  "orgDashboard/queries": typeof orgDashboard_queries;
  "orgOutreach/actions": typeof orgOutreach_actions;
  "orgOutreach/mutations": typeof orgOutreach_mutations;
  "orgOutreach/queries": typeof orgOutreach_queries;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "partners/admin": typeof partners_admin;
  "partners/commissions": typeof partners_commissions;
  "partners/internals": typeof partners_internals;
  "partners/mutations": typeof partners_mutations;
  "partners/notifications": typeof partners_notifications;
  "partners/queries": typeof partners_queries;
  "planner/aggregates": typeof planner_aggregates;
  "planner/mutations": typeof planner_mutations;
  "planner/queries": typeof planner_queries;
  "referrals/actions": typeof referrals_actions;
  "referrals/internal": typeof referrals_internal;
  "referrals/mutations": typeof referrals_mutations;
  "referrals/queries": typeof referrals_queries;
  "registrations/mutations": typeof registrations_mutations;
  "registrations/queries": typeof registrations_queries;
  "reviews/mutations": typeof reviews_mutations;
  "reviews/queries": typeof reviews_queries;
  "scraping/actions": typeof scraping_actions;
  "scraping/contactExtractor": typeof scraping_contactExtractor;
  "scraping/contactExtractorHelpers": typeof scraping_contactExtractorHelpers;
  "scraping/coverage": typeof scraping_coverage;
  "scraping/dailyReport": typeof scraping_dailyReport;
  "scraping/dailyReportQueries": typeof scraping_dailyReportQueries;
  "scraping/data": typeof scraping_data;
  "scraping/dataQualityActions": typeof scraping_dataQualityActions;
  "scraping/dataQualityChecks": typeof scraping_dataQualityChecks;
  "scraping/debug": typeof scraping_debug;
  "scraping/deduplication": typeof scraping_deduplication;
  "scraping/development": typeof scraping_development;
  "scraping/diagnostics": typeof scraping_diagnostics;
  "scraping/directories": typeof scraping_directories;
  "scraping/directoryDaemon": typeof scraping_directoryDaemon;
  "scraping/directoryDaemonActions": typeof scraping_directoryDaemonActions;
  "scraping/discoveryAction": typeof scraping_discoveryAction;
  "scraping/falCreditCheck": typeof scraping_falCreditCheck;
  "scraping/falCreditQueries": typeof scraping_falCreditQueries;
  "scraping/fixOrgWebsites": typeof scraping_fixOrgWebsites;
  "scraping/generateImages": typeof scraping_generateImages;
  "scraping/imageWorkflow": typeof scraping_imageWorkflow;
  "scraping/images": typeof scraping_images;
  "scraping/import": typeof scraping_import;
  "scraping/importMutations": typeof scraping_importMutations;
  "scraping/internal": typeof scraping_internal;
  "scraping/jobs": typeof scraping_jobs;
  "scraping/marketDiscovery": typeof scraping_marketDiscovery;
  "scraping/marketDiscoveryAction": typeof scraping_marketDiscoveryAction;
  "scraping/marketSeeding": typeof scraping_marketSeeding;
  "scraping/mutations": typeof scraping_mutations;
  "scraping/newDirectoryActions": typeof scraping_newDirectoryActions;
  "scraping/omsi": typeof scraping_omsi;
  "scraping/pipelineOrchestrator": typeof scraping_pipelineOrchestrator;
  "scraping/populateCampImages": typeof scraping_populateCampImages;
  "scraping/populateOrgLogos": typeof scraping_populateOrgLogos;
  "scraping/queries": typeof scraping_queries;
  "scraping/refreshTrackersImages": typeof scraping_refreshTrackersImages;
  "scraping/scrapeWorkflow": typeof scraping_scrapeWorkflow;
  "scraping/scraperAutomation": typeof scraping_scraperAutomation;
  "scraping/scraperCodeValidation": typeof scraping_scraperCodeValidation;
  "scraping/scraperConfig": typeof scraping_scraperConfig;
  "scraping/scrapers/executor": typeof scraping_scrapers_executor;
  "scraping/scrapers/omsi": typeof scraping_scrapers_omsi;
  "scraping/scrapers/types": typeof scraping_scrapers_types;
  "scraping/seedAdditionalSources": typeof scraping_seedAdditionalSources;
  "scraping/seedSources": typeof scraping_seedSources;
  "scraping/sourceRecovery": typeof scraping_sourceRecovery;
  "scraping/sources": typeof scraping_sources;
  "scraping/urlDiscovery": typeof scraping_urlDiscovery;
  "scraping/validation": typeof scraping_validation;
  seed: typeof seed;
  "sessions/mutations": typeof sessions_mutations;
  "sessions/queries": typeof sessions_queries;
  "sessions/seoQueries": typeof sessions_seoQueries;
  "share/queries": typeof share_queries;
  "social/mutations": typeof social_mutations;
  "social/queries": typeof social_queries;
  subscriptions: typeof subscriptions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: {
    event: {
      create: FunctionReference<
        "mutation",
        "internal",
        { name: string; workflowId: string },
        string
      >;
      send: FunctionReference<
        "mutation",
        "internal",
        {
          eventId?: string;
          name?: string;
          result:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId?: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        string
      >;
    };
    journal: {
      load: FunctionReference<
        "query",
        "internal",
        { shortCircuit?: boolean; workflowId: string },
        {
          blocked?: boolean;
          journalEntries: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          ok: boolean;
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      startSteps: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          steps: Array<{
            retry?:
              | boolean
              | { base: number; initialBackoffMs: number; maxAttempts: number };
            schedulerOptions?: { runAt?: number } | { runAfter?: number };
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
          }>;
          workflowId: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        Array<{
          _creationTime: number;
          _id: string;
          step:
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                functionType: "query" | "mutation" | "action";
                handle: string;
                inProgress: boolean;
                kind?: "function";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workId?: string;
              }
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                handle: string;
                inProgress: boolean;
                kind: "workflow";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workflowId?: string;
              }
            | {
                args: { eventId?: string };
                argsSize: number;
                completedAt?: number;
                eventId?: string;
                inProgress: boolean;
                kind: "event";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
              };
          stepNumber: number;
          workflowId: string;
        }>
      >;
    };
    workflow: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        null
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        boolean
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          runResult:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId: string;
        },
        null
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          maxParallelism?: number;
          onComplete?: { context?: any; fnHandle: string };
          startAsync?: boolean;
          workflowArgs: any;
          workflowHandle: string;
          workflowName: string;
        },
        string
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { workflowId: string },
        {
          inProgress: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listByName: FunctionReference<
        "query",
        "internal",
        {
          name: string;
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listSteps: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          workflowId: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            completedAt?: number;
            eventId?: string;
            kind: "function" | "workflow" | "event";
            name: string;
            nestedWorkflowId?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt: number;
            stepId: string;
            stepNumber: number;
            workId?: string;
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
  stripe: {
    private: {
      handleCheckoutSessionCompleted: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: any;
          mode: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        },
        null
      >;
      handleCustomerCreated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null
      >;
      handleCustomerUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null
      >;
      handleInvoiceCreated: FunctionReference<
        "mutation",
        "internal",
        {
          amountDue: number;
          amountPaid: number;
          created: number;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
        },
        null
      >;
      handleInvoicePaid: FunctionReference<
        "mutation",
        "internal",
        { amountPaid: number; stripeInvoiceId: string },
        null
      >;
      handleInvoicePaymentFailed: FunctionReference<
        "mutation",
        "internal",
        { stripeInvoiceId: string },
        null
      >;
      handlePaymentIntentSucceeded: FunctionReference<
        "mutation",
        "internal",
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
        },
        null
      >;
      handleSubscriptionCreated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
        },
        null
      >;
      handleSubscriptionDeleted: FunctionReference<
        "mutation",
        "internal",
        { stripeSubscriptionId: string },
        null
      >;
      handleSubscriptionUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          priceId?: string;
          quantity?: number;
          status: string;
          stripeSubscriptionId: string;
        },
        null
      >;
      updatePaymentCustomer: FunctionReference<
        "mutation",
        "internal",
        { stripeCustomerId: string; stripePaymentIntentId: string },
        null
      >;
      updateSubscriptionQuantityInternal: FunctionReference<
        "mutation",
        "internal",
        { quantity: number; stripeSubscriptionId: string },
        null
      >;
    };
    public: {
      createOrUpdateCustomer: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        string
      >;
      getCustomer: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        } | null
      >;
      getPayment: FunctionReference<
        "query",
        "internal",
        { stripePaymentIntentId: string },
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        } | null
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { stripeSubscriptionId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null
      >;
      getSubscriptionByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null
      >;
      listInvoices: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listInvoicesByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listInvoicesByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listPayments: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listPaymentsByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listPaymentsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listSubscriptions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>
      >;
      listSubscriptionsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>
      >;
      updateSubscriptionMetadata: FunctionReference<
        "mutation",
        "internal",
        {
          metadata: any;
          orgId?: string;
          stripeSubscriptionId: string;
          userId?: string;
        },
        null
      >;
      updateSubscriptionQuantity: FunctionReference<
        "action",
        "internal",
        { apiKey: string; quantity: number; stripeSubscriptionId: string },
        null
      >;
    };
  };
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: Array<string> | string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bcc?: Array<string>;
          bounced?: boolean;
          cc?: Array<string>;
          clicked?: boolean;
          complained: boolean;
          createdAt: number;
          deliveryDelayed?: boolean;
          errorMessage?: string;
          failed?: boolean;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bounced: boolean;
          clicked: boolean;
          complained: boolean;
          deliveryDelayed: boolean;
          errorMessage: string | null;
          failed: boolean;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          bcc?: Array<string>;
          cc?: Array<string>;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
  sessionsBySource: {
    btree: {
      aggregateBetween: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any },
        { count: number; sum: number }
      >;
      aggregateBetweenBatch: FunctionReference<
        "query",
        "internal",
        { queries: Array<{ k1?: any; k2?: any; namespace?: any }> },
        Array<{ count: number; sum: number }>
      >;
      atNegativeOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffsetBatch: FunctionReference<
        "query",
        "internal",
        {
          queries: Array<{
            k1?: any;
            k2?: any;
            namespace?: any;
            offset: number;
          }>;
        },
        Array<{ k: any; s: number; v: any }>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: any; namespace?: any },
        null | { k: any; s: number; v: any }
      >;
      offset: FunctionReference<
        "query",
        "internal",
        { k1?: any; key: any; namespace?: any },
        number
      >;
      offsetUntil: FunctionReference<
        "query",
        "internal",
        { k2?: any; key: any; namespace?: any },
        number
      >;
      paginate: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          k1?: any;
          k2?: any;
          limit: number;
          namespace?: any;
          order: "asc" | "desc";
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<{ k: any; s: number; v: any }>;
        }
      >;
      paginateNamespaces: FunctionReference<
        "query",
        "internal",
        { cursor?: string; limit: number },
        { cursor: string; isDone: boolean; page: Array<any> }
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { namespace?: any },
        any
      >;
    };
    inspect: {
      display: FunctionReference<"query", "internal", { namespace?: any }, any>;
      dump: FunctionReference<"query", "internal", { namespace?: any }, string>;
      inspectNode: FunctionReference<
        "query",
        "internal",
        { namespace?: any; node?: string },
        null
      >;
      listTreeNodes: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregate?: { count: number; sum: number };
          items: Array<{ k: any; s: number; v: any }>;
          subtrees: Array<string>;
        }>
      >;
      listTrees: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          maxNodeSize: number;
          namespace?: any;
          root: string;
        }>
      >;
    };
    public: {
      clear: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      delete_: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        null
      >;
      deleteIfExists: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        any
      >;
      init: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any; summand?: number; value: any },
        null
      >;
      makeRootLazy: FunctionReference<
        "mutation",
        "internal",
        { namespace?: any },
        null
      >;
      replace: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        null
      >;
      replaceOrInsert: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        any
      >;
    };
  };
  sessionsByCity: {
    btree: {
      aggregateBetween: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any },
        { count: number; sum: number }
      >;
      aggregateBetweenBatch: FunctionReference<
        "query",
        "internal",
        { queries: Array<{ k1?: any; k2?: any; namespace?: any }> },
        Array<{ count: number; sum: number }>
      >;
      atNegativeOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffsetBatch: FunctionReference<
        "query",
        "internal",
        {
          queries: Array<{
            k1?: any;
            k2?: any;
            namespace?: any;
            offset: number;
          }>;
        },
        Array<{ k: any; s: number; v: any }>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: any; namespace?: any },
        null | { k: any; s: number; v: any }
      >;
      offset: FunctionReference<
        "query",
        "internal",
        { k1?: any; key: any; namespace?: any },
        number
      >;
      offsetUntil: FunctionReference<
        "query",
        "internal",
        { k2?: any; key: any; namespace?: any },
        number
      >;
      paginate: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          k1?: any;
          k2?: any;
          limit: number;
          namespace?: any;
          order: "asc" | "desc";
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<{ k: any; s: number; v: any }>;
        }
      >;
      paginateNamespaces: FunctionReference<
        "query",
        "internal",
        { cursor?: string; limit: number },
        { cursor: string; isDone: boolean; page: Array<any> }
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { namespace?: any },
        any
      >;
    };
    inspect: {
      display: FunctionReference<"query", "internal", { namespace?: any }, any>;
      dump: FunctionReference<"query", "internal", { namespace?: any }, string>;
      inspectNode: FunctionReference<
        "query",
        "internal",
        { namespace?: any; node?: string },
        null
      >;
      listTreeNodes: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregate?: { count: number; sum: number };
          items: Array<{ k: any; s: number; v: any }>;
          subtrees: Array<string>;
        }>
      >;
      listTrees: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          maxNodeSize: number;
          namespace?: any;
          root: string;
        }>
      >;
    };
    public: {
      clear: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      delete_: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        null
      >;
      deleteIfExists: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        any
      >;
      init: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any; summand?: number; value: any },
        null
      >;
      makeRootLazy: FunctionReference<
        "mutation",
        "internal",
        { namespace?: any },
        null
      >;
      replace: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        null
      >;
      replaceOrInsert: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        any
      >;
    };
  };
  rateLimiter: {
    lib: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
      getValue: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          key?: string;
          name: string;
          sampleShards?: number;
        },
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          shard: number;
          ts: number;
          value: number;
        }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
    time: {
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
};
