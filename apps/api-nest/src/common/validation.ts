import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ErrorDetail } from './api-exception.js';

type PathSegment = PropertyKey | StandardSchemaV1.PathSegment;

function segmentKey(segment: PathSegment): PropertyKey {
  return typeof segment === 'object' ? segment.key : segment;
}

/**
 * Maps schema issues to `{ field, message }` details: the field is the first path segment (the
 * top-level request property), `body` for issues about the payload as a whole. One entry per field.
 */
export function issuesToDetails(issues: readonly StandardSchemaV1.Issue[]): ErrorDetail[] {
  const byField = new Map<string, string>();
  for (const issue of issues) {
    const first = issue.path?.[0];
    const field = first === undefined ? 'body' : String(segmentKey(first));
    if (!byField.has(field)) byField.set(field, issue.message);
  }
  return [...byField].map(([field, message]) => ({ field, message }));
}
