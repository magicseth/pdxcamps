/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as camps_mutations from "../camps/mutations.js";
import type * as camps_queries from "../camps/queries.js";
import type * as children_mutations from "../children/mutations.js";
import type * as children_queries from "../children/queries.js";
import type * as cities_mutations from "../cities/mutations.js";
import type * as cities_queries from "../cities/queries.js";
import type * as crons from "../crons.js";
import type * as discovery_actions from "../discovery/actions.js";
import type * as discovery_mutations from "../discovery/mutations.js";
import type * as discovery_queries from "../discovery/queries.js";
import type * as families_mutations from "../families/mutations.js";
import type * as families_queries from "../families/queries.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_validators from "../lib/validators.js";
import type * as locations_mutations from "../locations/mutations.js";
import type * as locations_queries from "../locations/queries.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as registrations_mutations from "../registrations/mutations.js";
import type * as registrations_queries from "../registrations/queries.js";
import type * as scraping_actions from "../scraping/actions.js";
import type * as scraping_internal from "../scraping/internal.js";
import type * as scraping_mutations from "../scraping/mutations.js";
import type * as scraping_omsi from "../scraping/omsi.js";
import type * as scraping_queries from "../scraping/queries.js";
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
  "camps/mutations": typeof camps_mutations;
  "camps/queries": typeof camps_queries;
  "children/mutations": typeof children_mutations;
  "children/queries": typeof children_queries;
  "cities/mutations": typeof cities_mutations;
  "cities/queries": typeof cities_queries;
  crons: typeof crons;
  "discovery/actions": typeof discovery_actions;
  "discovery/mutations": typeof discovery_mutations;
  "discovery/queries": typeof discovery_queries;
  "families/mutations": typeof families_mutations;
  "families/queries": typeof families_queries;
  "lib/auth": typeof lib_auth;
  "lib/helpers": typeof lib_helpers;
  "lib/validators": typeof lib_validators;
  "locations/mutations": typeof locations_mutations;
  "locations/queries": typeof locations_queries;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "registrations/mutations": typeof registrations_mutations;
  "registrations/queries": typeof registrations_queries;
  "scraping/actions": typeof scraping_actions;
  "scraping/internal": typeof scraping_internal;
  "scraping/mutations": typeof scraping_mutations;
  "scraping/omsi": typeof scraping_omsi;
  "scraping/queries": typeof scraping_queries;
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

export declare const components: {};
