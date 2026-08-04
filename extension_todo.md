# Extension TODO

Known caveats, gaps, and deferred work in this extension - not user-facing, for contributors
deciding what to pick up next. Each entry should point at the concrete file(s)/function(s)
involved so it stays checkable against the current code rather than going stale as prose.

## Open

### Live Agent Policy download lookup isn't space-aware

`findAgentPolicyFilePathById` (`src/repositories.ts`) matches a live agent policy to its
downloaded local copy by `id` alone - there's no space in the key. Fleet Agent Policies are now
browsed per Kibana Space in the tree (see `claude.md`'s "Connections" section,
`getLiveAgentPolicySpaceItems`/`getLiveAgentPolicyItems` in `src/treeView/elasticTreeProvider.ts`),
and the same `id` can legitimately exist in more than one space. If two same-`id` agent policies
from different spaces are ever downloaded, `downloadLiveIntegrationPolicy`
(`src/extension.ts`) can resolve to the wrong local folder when nesting a new Integration Policy
under one of them.

Fixing this needs a space field added to the downloaded `FleetAgentPolicy` file shape
(`src/models.ts`) and threaded through `downloadAgentPolicy`/`findAgentPolicyFilePathById`
(`src/repositories.ts`). Low priority until someone actually hits an id collision across spaces
in practice.

## Resolved

### Live Fleet fetches don't paginate past 100 items

`fetchAgentPolicies`/`fetchPackagePolicies` (`src/connections/kibanaClient.ts`) used to request a
single `perPage=100` page rather than following the Fleet API's pagination. Fixed by
`fetchAllPages` (`src/connections/kibanaClient.ts`), a shared helper both functions now go
through: it keeps requesting `page=1`, `page=2`, ... until the accumulated item count reaches the
response's `total`, or a page comes back short (fewer than `perPage` items, a safety net for a
deployment that never reports `total`). Applies per space, same as before.
