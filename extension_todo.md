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

### Live Fleet fetches don't paginate past 100 items

`fetchAgentPolicies`/`fetchPackagePolicies` (`src/connections/kibanaClient.ts`) each request a
single `perPage=100` page rather than following the Fleet API's pagination - per space, now that
Agent Policies are fetched per Kibana Space. A deployment with more than 100 agent policies or
integration policies in one space will silently show only the first page in the tree. Acceptable
for the read-only browse view this was built for; revisit if it turns out to matter for larger
real deployments.

## Resolved

(move an entry here with a one-line "fixed by <commit/PR>" note, or just delete it, once closed)
