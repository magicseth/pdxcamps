/**
 * Session Count Aggregate
 *
 * Uses @convex-dev/aggregate to maintain accurate session counts per source
 * without requiring full table scans. This avoids read-write conflicts that
 * occurred when counting sessions during concurrent imports.
 *
 * The aggregate tracks:
 * - Total session count per sourceId (namespace)
 */

import { TableAggregate } from '@convex-dev/aggregate';
import { components } from '../_generated/api';
import { DataModel, Doc } from '../_generated/dataModel';

/**
 * Aggregate for counting sessions by sourceId.
 *
 * Namespace: sourceId (string) - sessions are partitioned by their source
 * Key: null - we just want counts, not ordering within a source
 * SumValue: 1 for each session (gives us count via sum)
 *
 * Sessions without a sourceId go to the "none" namespace.
 */
export const sessionsBySourceAggregate = new TableAggregate<{
  Namespace: string;
  Key: null;
  DataModel: DataModel;
  TableName: 'sessions';
}>(components.sessionsBySource, {
  namespace: (doc) => doc.sourceId ?? 'none',
  sortKey: () => null,
  sumValue: () => 1,
});

/**
 * Get the namespace key for a session's sourceId.
 * Sessions without a sourceId are grouped under "none".
 */
export function getSourceNamespace(sourceId: string | undefined | null): string {
  return sourceId ?? 'none';
}
