/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_mutations from "../admin/mutations.js";
import type * as admin_queries from "../admin/queries.js";
import type * as camps_mutations from "../camps/mutations.js";
import type * as camps_queries from "../camps/queries.js";
import type * as children_mutations from "../children/mutations.js";
import type * as children_queries from "../children/queries.js";
import type * as cities_mutations from "../cities/mutations.js";
import type * as cities_queries from "../cities/queries.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as discovery_actions from "../discovery/actions.js";
import type * as discovery_mutations from "../discovery/mutations.js";
import type * as discovery_queries from "../discovery/queries.js";
import type * as families_mutations from "../families/mutations.js";
import type * as families_queries from "../families/queries.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_geocoding from "../lib/geocoding.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_validators from "../lib/validators.js";
import type * as locations_mutations from "../locations/mutations.js";
import type * as locations_queries from "../locations/queries.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as planner_mutations from "../planner/mutations.js";
import type * as planner_queries from "../planner/queries.js";
import type * as registrations_mutations from "../registrations/mutations.js";
import type * as registrations_queries from "../registrations/queries.js";
import type * as scraping_actions from "../scraping/actions.js";
import type * as scraping_coverage from "../scraping/coverage.js";
import type * as scraping_deduplication from "../scraping/deduplication.js";
import type * as scraping_development from "../scraping/development.js";
import type * as scraping_fixOrgWebsites from "../scraping/fixOrgWebsites.js";
import type * as scraping_generateImages from "../scraping/generateImages.js";
import type * as scraping_imageWorkflow from "../scraping/imageWorkflow.js";
import type * as scraping_images from "../scraping/images.js";
import type * as scraping_import from "../scraping/import.js";
import type * as scraping_importMutations from "../scraping/importMutations.js";
import type * as scraping_internal from "../scraping/internal.js";
import type * as scraping_mutations from "../scraping/mutations.js";
import type * as scraping_omsi from "../scraping/omsi.js";
import type * as scraping_populateCampImages from "../scraping/populateCampImages.js";
import type * as scraping_populateOrgLogos from "../scraping/populateOrgLogos.js";
import type * as scraping_queries from "../scraping/queries.js";
import type * as scraping_refreshTrackersImages from "../scraping/refreshTrackersImages.js";
import type * as scraping_scrapers_executor from "../scraping/scrapers/executor.js";
import type * as scraping_scrapers_omsi from "../scraping/scrapers/omsi.js";
import type * as scraping_scrapers_types from "../scraping/scrapers/types.js";
import type * as scraping_seedAdditionalSources from "../scraping/seedAdditionalSources.js";
import type * as scraping_seedSources from "../scraping/seedSources.js";
import type * as scraping_urlDiscovery from "../scraping/urlDiscovery.js";
import type * as scraping_validation from "../scraping/validation.js";
import type * as seed from "../seed.js";
import type * as sessions_mutations from "../sessions/mutations.js";
import type * as sessions_queries from "../sessions/queries.js";
import type * as social_mutations from "../social/mutations.js";
import type * as social_queries from "../social/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/mutations": typeof admin_mutations;
  "admin/queries": typeof admin_queries;
  "camps/mutations": typeof camps_mutations;
  "camps/queries": typeof camps_queries;
  "children/mutations": typeof children_mutations;
  "children/queries": typeof children_queries;
  "cities/mutations": typeof cities_mutations;
  "cities/queries": typeof cities_queries;
  cleanup: typeof cleanup;
  crons: typeof crons;
  "discovery/actions": typeof discovery_actions;
  "discovery/mutations": typeof discovery_mutations;
  "discovery/queries": typeof discovery_queries;
  "families/mutations": typeof families_mutations;
  "families/queries": typeof families_queries;
  "lib/auth": typeof lib_auth;
  "lib/geocoding": typeof lib_geocoding;
  "lib/helpers": typeof lib_helpers;
  "lib/validators": typeof lib_validators;
  "locations/mutations": typeof locations_mutations;
  "locations/queries": typeof locations_queries;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "planner/mutations": typeof planner_mutations;
  "planner/queries": typeof planner_queries;
  "registrations/mutations": typeof registrations_mutations;
  "registrations/queries": typeof registrations_queries;
  "scraping/actions": typeof scraping_actions;
  "scraping/coverage": typeof scraping_coverage;
  "scraping/deduplication": typeof scraping_deduplication;
  "scraping/development": typeof scraping_development;
  "scraping/fixOrgWebsites": typeof scraping_fixOrgWebsites;
  "scraping/generateImages": typeof scraping_generateImages;
  "scraping/imageWorkflow": typeof scraping_imageWorkflow;
  "scraping/images": typeof scraping_images;
  "scraping/import": typeof scraping_import;
  "scraping/importMutations": typeof scraping_importMutations;
  "scraping/internal": typeof scraping_internal;
  "scraping/mutations": typeof scraping_mutations;
  "scraping/omsi": typeof scraping_omsi;
  "scraping/populateCampImages": typeof scraping_populateCampImages;
  "scraping/populateOrgLogos": typeof scraping_populateOrgLogos;
  "scraping/queries": typeof scraping_queries;
  "scraping/refreshTrackersImages": typeof scraping_refreshTrackersImages;
  "scraping/scrapers/executor": typeof scraping_scrapers_executor;
  "scraping/scrapers/omsi": typeof scraping_scrapers_omsi;
  "scraping/scrapers/types": typeof scraping_scrapers_types;
  "scraping/seedAdditionalSources": typeof scraping_seedAdditionalSources;
  "scraping/seedSources": typeof scraping_seedSources;
  "scraping/urlDiscovery": typeof scraping_urlDiscovery;
  "scraping/validation": typeof scraping_validation;
  seed: typeof seed;
  "sessions/mutations": typeof sessions_mutations;
  "sessions/queries": typeof sessions_queries;
  "social/mutations": typeof social_mutations;
  "social/queries": typeof social_queries;
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
};
