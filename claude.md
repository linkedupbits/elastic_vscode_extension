# Overview
This project will implement a VS Code Extension. 
The purpose of the extension is to manage the definition of the Elastic Cloud run-time artifacts.

Initially this project will focus on managing Elastic Fleet Agent Policies.

This project should implement comprehensive unit tests.

The intent of the extension is to provide a way to maintin the infrastructure as code definitions, without a developer needing to understand the exact json structure of every API's Payload.

It will allow the developed a design-time experience equivalent to managing an Elastic CLoud deployment via Click-Ops.

The Extension should use the VS Code Extension [Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) to allow developers to navigate the Elastic Code Project. Within the tree view thay should be able select an artifact to edit it, or have the option to create a new artifact of that type. 

Where artifacts are defined in JSON format, the extension should deliver a structured maintainance screen that removes the need for developers to edit the JSON directly - the UI should provide a structured editing experience and save to required JSON file format.


`/Elastic_Source` - this is the root of the elastic "project" this extension will manage. This folder should be able to be edited in the Extensions configuration, but default to the value `Elastic_Source`. See https://code.visualstudio.com/api/references/contribution-points#contributes.configuration 

`/Elastic_Source/Logical_Environments/master_definition.yaml` this YAML file contains the definition of the project artifacts that will be deployed to Elastic Cloud. It should mimic the folder structure employed.

`/Elastic_Source/Fleet_Proxies/` - this folder contains a set of json files, each of which defines an on-prem Proxy server that can be referenced by a Fleet_Download_source
```json
{
    "id": "aa409131-e0d3-42c6-b68a-8218273b1b87",
    "name": "WNP Proxy",
    "url": "http://the-proxy-server.internal.example.com:3128",
    "certificate_authorities": "",
    "certificates": "",
    "certificate_key": "",
    "is_preconfigured": false
}
```
* The ID is a guid and should be generated when the extension user adds a new Fleet Proxy definition. This should be read-only for the Extension User.
* The extension should validate the url attribute value is a valid URL before saving.

`/Elastic_Source/Fleet_Download_Sources/`- this folder defines the Elastic Fleet Download Sources that can be referenced by a Fleet Agent Policy. Each Download Source is defined in a json file that 
```json
{
    "id": "45ce4467-501f-49a6-94b9-682cf5c04928",
    "name": "On-Prem Download Source",
    "host": "https://artifacts.elastic.co/downhload",
    "is_default": false,
    "proxy_id": "aa409131-e0d3-42c6-b68a-8218273b1b87"
}
```
* The id attribute is a GUID that should be generated whenever a new Download Source is added. It should be read-only for the extension  user.
* The proxy_id value should be a drop down of the proxies defined in the project, or able to be left blank. The drop down should display the proxy's "name" attribute value, but save the proxy's id attribute. 


 `/Elastic_Source/Fleet_Agent_Policies` this folder contains a sub folder per Fleet Agent Policy to be deployed to Elastic Cloud. Inside each Agent Policies' folder will be another json file named the same as the Folder eg `/Elastic_Source/Fleet_Agent_Policies/CMT Default/CMT Default.json`

 The structure of the json (eg for the `CMT Default.json` above) should be in the same json needed to upload to the Elastic Cloud API (see [Create Agent Policies](https://www.elastic.co/docs/api/doc/serverless/operation/operation-post-fleet-agent-policies)) 

 ```json
 {
  "id": "a80475ca-e57f-475b-a313-120d4a30bc2a",
  "name": "CMT Default",
  "description": "Default Agent Policy for CMT servers",
  "monitoring_enabled": [
    "logs",
    "metrics"
  ],
  "inactivity_timeout": 1209600,
  "download_source_id": "45ce4467-501f-49a6-94b9-682cf5c04928",
  "schema_version": "1.1.1",
  "namespace": "cmtdev",
  "advanced_settings": {
    "agent_logging_level"
  },
  "namespace": "default"
}
```
* The folder name/file name must be the same as the name attribute.
* The id should be generated if the extension user adds a new agent policy and read only.
* The download_source_id value should be a drop down of the dowload sources defined in the project, or able to be left blank. The drop down should display the download sources name but save the download source's id attribute value.

`/Elastic_Source/Fleet_Agent_Policies/<Agent Policy>/Integrations/<Integration Policy.json>` - these files (underneath an Agent Policy) define the Elastic Integration Policies that will be deployed with the Agent Policy.
These are JSON file.
Each Integration Policy is defines the inputs for a specific Integration type.

When adding an integraion policy to an agent policy, the Integration Type must be selected first. 

These are the currently supported Integration types. Every (package name, version) pair below has its own `PackageTemplate` file under `src/integrations/`, transcribed directly from the real manifest data published for that exact version on the [Elastic Package Registry](https://epr.elastic.co) (EPR) - never invented or guessed. All file/export names are version-namespaced, including a package's only (or "current") version: `<package>Package_<version_with_underscores>.ts` exporting `<package>PackageTemplate_<version_with_underscores>` (e.g. `nginxPackage_3_2_1.ts` exports `nginxPackageTemplate_3_2_1`).

| Package name | Title | Version | Template file | EPR source used | Notes |
| --- | --- | --- | --- | --- | --- |
| `system` | System | 2.22.1 | `systemPackage_2_22_1.ts` | `epr.elastic.co/epr/system/system-2.22.1.zip` | current upstream version; examples: [system-cmt-default.json](examples/Integrations/System/system-cmt-default.json), [system-cmt-timbre.json](examples/Integrations/System/system-cmt-timbre.json) |
| `system` | System | 2.6.3 | `systemPackage_2_6_3.ts` | `epr.elastic.co/epr/system/system-2.6.3.zip` | no `ntp` stream (like 2.3.2); OS-match condition is intermediate between 2.3.2 and 2.22.1; winlog `language` var is manifest-typed `text` here (mapped to `string`) unlike `integer` in the other two versions |
| `system` | System | 2.3.2 | `systemPackage_2_3_2.ts` | `epr.elastic.co/epr/system/system-2.3.2.zip` | no `ntp` stream, simpler logfile/journald OS-match conditions |
| `nginx` | Nginx | 3.2.1 | `nginxPackage_3_2_1.ts` | `epr.elastic.co/epr/nginx/nginx-3.2.1.zip` | current upstream version |
| `nginx` | Nginx | 2.0.0 | `nginxPackage_2_0_0.ts` | `epr.elastic.co/epr/nginx/nginx-2.0.0.zip` | same inputs/streams as 3.2.1, but neither input declares the `condition` var |
| `apache` | Apache HTTP Server | 2.0.0 | `apachePackage_2_0_0.ts` | `epr.elastic.co/epr/apache/apache-2.0.0.zip` | inputs: `logfile` (streams `access`, `error`), `apache/metrics` (stream `status`); no `requires_root` |
| `apm` | Elastic APM | 9.0.3 | `apmPackage_9_0_3.ts` | `epr.elastic.co/epr/apm/apm-9.0.0-preview-1738343125.zip` ⚠️ | **version 9.0.3 was never published to EPR** (the real sequence jumps 9.0.0-preview → 9.1.0-preview); field data was sourced from the nearest real build, 9.0.0-preview, while the `version` string was kept as `9.0.3`. Also structurally unlike every other package here: upstream removed all data streams from the manifest in 8.15.0-preview (apm-server now manages its own outputs), so this is modeled as a single `apm-apm` input carrying ~40 server-config vars plus one placeholder stream (`apm.server`) with no real `data_stream/` backing it, added only to satisfy this project's "every input needs a stream" invariant |
| `mysql` | MySQL | 1.26.1 | `mysqlPackage_1_26_1.ts` | `epr.elastic.co/epr/mysql/mysql-1.26.1.zip` | inputs: `logfile` (streams `error`, `slowlog`), `mysql/metrics` (streams `status`, `performance`, `galera_status` - disabled by default), `sql/metrics` (stream `replica_status`); no `requires_root` |
| `filestream` | Custom Logs (Filestream) | 1.1.5 | `filestreamPackage_1_1_5.ts` | `epr.elastic.co/epr/filestream/filestream-1.1.5.zip` | single input `filestream` (no input-level vars), single stream `generic` with 34 vars |
| `filestream` | Custom Logs (Filestream) | 1.1.3 | `filestreamPackage_1_1_3.ts` | `epr.elastic.co/epr/filestream/filestream-1.1.3.zip` | verified byte-for-byte structurally identical to 1.1.5 (manifests differ only in the `version:` field and cosmetic description formatting) |
| `php_fpm` | PHP-FPM | 1.6.0 | `phpFpmPackage_1_6_0.ts` | `epr.elastic.co/epr/php_fpm/php_fpm-1.6.0.zip` | input `httpjson`, streams `process` and `pool`; no `requires_root` |
| `prometheus` | Prometheus | 1.23.1 | `prometheusPackage_1_23_1.ts` | `epr.elastic.co/epr/prometheus/prometheus-1.23.1.zip` | input `prometheus/metrics` (no input-level vars), streams `collector` (enabled by default), `query` and `remote_write` (both disabled by default per the manifest); no `requires_root` |
| `log` | Custom Logs (Deprecated) | 2.4.4 | `logPackage_2_4_4.ts` | `epr.elastic.co/epr/log/log-2.4.4.zip` | an EPR "input package" (`type: input` in its manifest) with no `data_stream/` directories at all - modeled as a single input/stream pair whose vars come directly from `policy_templates[0].vars` |
| `postgresql` | PostgreSQL | 1.28.0 | `postgresqlPackage_1_28_0.ts` | `epr.elastic.co/epr/postgresql/postgresql-1.28.0.zip` | inputs: `logfile` (stream `log`), `postgresql/metrics` (streams `activity`, `bgwriter`, `database`, `statement`); no `requires_root` |

Each supported Integration type is described as a structural template (inputs → streams → vars, with each var's type, default value, and whether it is `required`) rather than being hand-coded field by field, so adding another Integration type mainly means transcribing its package manifest into a new template.

Vars marked `required` in the source package manifest (e.g. Nginx's `paths`, `tags`, `hosts`, `period`, `server_status_path`) must be non-blank before saving, but only while their owning input/stream is enabled - a disabled input or stream is not required to have valid values.

**Multiple template versions per Integration type**: a package name can have more than one structured template registered, one per package version this project has transcribed (e.g. System has 2.22.1, 2.6.3 and 2.3.2; Nginx has 3.2.1 and 2.0.0; see the table above). This is what `integrationPackageTemplates: Record<string, PackageTemplate[]>` in `src/integrations/registry.ts` holds - an array of `PackageTemplate`s per package name, not a single one. `resolveIntegrationTemplate(name, version?)` requires an exact version match to resolve a specific template; called with no version it only succeeds when exactly one template is registered for that name (there's no implicit "latest" - an unversioned lookup against a package with multiple registered versions returns `undefined`, the same as an unrecognized package, so the caller is forced to disambiguate). `getIntegrationTemplateChoices()` (used by the "New Integration Policy" picker) lists one entry per `(name, version)` pair, so a multi-version package shows up as multiple picker entries (e.g. "System" v2.22.1 and "System" v2.3.2) distinguished by their version description. **To add support for another version of an already-supported package (or a brand new package)**: create a new template file named `<package>Package_<version_with_underscores>.ts`, exporting a `PackageTemplate` constant named `<package>PackageTemplate_<version_with_underscores>` (this naming applies uniformly now - there is no unversioned/"primary" filename even for a package's only registered version), then add it to that package's array in `registry.ts`. Everything downstream (the editor panel, the webview form, merge/save/validation logic) already operates generically on whatever single `PackageTemplate` it's handed - no changes are needed there.

**Sourcing package manifest data**: every template in the table above, current or historical, was built from the [Elastic Package Registry](https://epr.elastic.co) (EPR), not GitHub - GitHub's `elastic/integrations` `main` branch only ever reflects the *current* manifest for each package, so it can't source an older version like System 2.3.2, and using EPR uniformly for every version (rather than GitHub for "current" and EPR only for "historical") keeps the sourcing process one consistent recipe:
1. `curl https://epr.elastic.co/package/<name>/<version>/` returns that exact version's metadata JSON, confirming it's a real published version and giving its `download` zip path. (If this 404s, as it did for `apm` 9.0.3, check `epr.elastic.co/search?package=<name>&all=true&prerelease=true` and the package's own `changelog.yml` for the real version sequence, and note the discrepancy in the template's header comment rather than silently substituting data.)
2. `curl -o <name>-<version>.zip https://epr.elastic.co/epr/<name>/<name>-<version>.zip` downloads the package contents as a zip; `unzip` it to get the real `manifest.yml` (top-level `policy_templates[].inputs[]`, i.e. the input types and their input-level `vars`) and every `data_stream/<name>/manifest.yml` (that data stream's `streams[]`, matched by their `input:` type, with each stream's own `vars[]` and any `agent.privileges.root: true`) - all exactly as published for that version, not reconstructed from changelog notes or guessed.
3. Map the downloaded YAML onto a `PackageTemplate` (see `src/integrations/packageTemplate.ts` for the shape): each `policy_templates[].inputs[]` entry → an `InputDef` keyed `<package>-<input.type>` (e.g. `system-logfile`); each data stream's `streams[]` entry whose `input:` matches that type → a `StreamDef` keyed by the stream's dataset name (e.g. `system.auth`), with `requiresRoot: true` when that data stream declares `agent.privileges.root: true`, and `defaultEnabled: false` when the stream explicitly sets `enabled: false` (otherwise default `true` unless it's a Windows-only `winlog` stream, which this project defaults to disabled regardless, matching real-world Fleet behavior); each manifest `vars[]` entry → a `VarFieldDef`, mapping `type: text`+`multi: false` → `string`, `type: text`+`multi: true` → `stringArray`, `type: bool` → `boolean`, `type: integer` → `number`, `type: yaml` → `multiline`, `type: password` → `string`, `type: select` → `select` (mapping the manifest's `options: [{text, value}]` to `{value, label: text}`), and carrying over `required: true` and any `default` (falling back to the type's empty value - `[]`/`''`/`false`/`0` - when the manifest var has no `default:` at all). Only the fields the structured editor actually needs are captured - manifest metadata like `show_user` or field descriptions isn't part of `PackageTemplate` and can be left out.
4. Diff the new version's manifests against the existing template(s) for that package (if any) to call out in a comment what actually changed between versions (e.g. System 2.3.2 vs 2.22.1: no `ntp` stream, simpler OS-match conditions) - this is what lets a future reader trust the template without re-fetching the source themselves.

If an existing Integration Policy's `package.name`/`package.version` doesn't match one of the currently implemented templates in the table above (an unrecognized package, or a known package at a version this project hasn't transcribed a template for yet), the editor falls back to a plain JSON editor for `inputs` instead of the structured inputs/streams/vars form, and shows a warning banner at the top of the screen explaining that no structured editor is available for that type/version. **Name**, **Namespace** and **Description** remain regular structured fields in this fallback mode; `package` itself is always re-read from disk and re-saved unchanged, since there's no template to validate or regenerate it from (see `resolveIntegrationTemplate` in `src/integrations/registry.ts` and `src/editors/integrationPolicyEditorPanel.ts`). This fallback only applies to *existing* policies - the "New Integration Policy" flow only ever offers the currently implemented (type, version) pairs to choose from.

The `"policy_id"` attribute and values in the array of `"policy_ids"` should be set to be the id of the owning Agent Policy. 
```
  "policy_id": "80912b12-6a5f-4bf3-b1c8-9f42667515ed",
  "policy_ids": [
    "80912b12-6a5f-4bf3-b1c8-9f42667515ed"
  ],
```

`/Elastic_Source/Index_Lifecycle_Policies/` - this folder contains a set of json files, each of which defines an Elasticsearch Index Lifecycle Management policy. Each Index Lifecycle Policy is defined in a json file named the same as the policy's `name` attribute, eg `/Elastic_Source/Index_Lifecycle_Policies/logs-default-policy.json`.

The structure of the json follows the request body of the [ILM Put Lifecycle API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ilm-put-lifecycle), with `name` added at the top level since the API takes the policy name from the URL path rather than the body:
```json
{
  "name": "logs-default-policy",
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50gb",
            "max_age": "30d"
          },
          "set_priority": {
            "priority": 100
          }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  },
  "integration_lifecycle_mappings": [
    {
      "data_stream_type": "logs",
      "dataset_name": "map_python",
      "integration_name": "filestream",
      "namespace": "cmt"
    }
  ]
}
```
* The file name must be the same as the `name` attribute.
* Each phase (`hot`, `warm`, `cold`, `frozen`, `delete`) is rendered as its own collapsible, structured section with a checkbox to include/exclude that phase entirely, a "Minimum Age" field, and a checkbox-per-action to include/exclude each of that phase's actions along with that action's own fields - mirroring the inputs → streams → vars template pattern already used for Integration Policies (see `src/ilm/ilmPhaseTemplate.ts`). Disabled phases/actions are omitted entirely from the saved json rather than written out with default/empty values.
  * Hot: `rollover` (max_age, max_primary_shard_size, max_docs), `set_priority` (priority), `forcemerge` (max_num_segments), `shrink` (number_of_shards), `readonly`.
  * Warm: `set_priority`, `allocate` (number_of_replicas), `forcemerge`, `shrink`, `migrate` (enabled), `readonly`.
  * Cold: `set_priority`, `allocate`, `searchable_snapshot` (snapshot_repository), `migrate`, `readonly`.
  * Frozen: `searchable_snapshot` (snapshot_repository).
  * Delete: `wait_for_snapshot` (policy), `delete` (delete_searchable_snapshot).
  * At least one phase must be enabled before saving.
* `policy._meta` remains a free-form optional JSON editor, since it's arbitrary user metadata rather than a fixed schema.
* `integration_lifecycle_mappings` is a top-level array (a sibling of `policy`, not part of the Elasticsearch ILM API body) recording which integration data streams this policy should apply to. It is edited as a set of repeatable rows, each with:
  * `data_stream_type` - a dropdown restricted to `logs` or `metrics`.
  * `dataset_name`, `integration_name`, `namespace` - free text, all required for any row that exists.
  * Rows can be added/removed freely; the array may be empty. Any row that's present must have every field filled in before saving.

`/Elastic_Source/Ingest_Pipelines/` - this folder contains a set of json files, each of which defines an Elasticsearch ingest pipeline. Each pipeline is defined in a json file named the same as the pipeline's name, eg `/Elastic_Source/Ingest_Pipelines/logs-emailengine_wildfly@custom.json`.

The structure of the json follows the request body of the [Put Pipeline API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ingest-put-pipeline) directly - there's no wrapper key, and no `name` field either: unlike every other artifact type in this project, the pipeline's name is *only* ever the file name (matching how the real API itself takes the name from the URL path, not the body) and is never persisted inside the json:
```json
{
  "description": "Adds a few custom fields before the managed pipeline runs.",
  "processors": [
    {
      "set": {
        "field": "event.dataset",
        "value": "emailengine.wildfly"
      }
    }
  ],
  "on_failure": [
    {
      "set": {
        "field": "error.message",
        "value": "{{ _ingest.on_failure_message }}"
      }
    }
  ],
  "version": 1,
  "_meta": {
    "managed_by": "cmt"
  }
}
```
* Renaming a pipeline renames its file; there is no `name` key to keep in sync.
* `processors` is required (at least one) and `on_failure` is optional; both are edited as an ordered, repeatable list of structured processor rows (add/remove freely) rather than raw JSON, mirroring the inputs/streams/vars template pattern used for Integration Policies (see `src/ingest/ingestProcessorTemplate.ts`). Each row has:
  * A **Processor Type** dropdown covering a curated set of the most commonly used processor types: `set`, `remove`, `rename`, `append`, `convert`, `gsub`, `grok`, `dissect`, `date`, `json`, `script`, `pipeline`, `csv`, `kv`, `lowercase`, `uppercase`, `trim`, `split`, `geoip`, `user_agent`, `fail`, `drop` - each with its own structured fields (required ones enforced before saving).
  * A final **Custom / Other...** option for any processor type not in that curated list (e.g. `enrich`, plugin-provided processors, or future processor types), which instead exposes a free-text **Processor Type** name plus a JSON **Configuration** object for that type's parameters - this is also what any pipeline containing an uncurated processor type falls back to when reopened, so no data is lost.
  * Common **Tag**, **Condition** (Painless `if`) and **Ignore Failure** fields, supported by every processor type per the Put Pipeline API and rendered the same way regardless of which type is selected.
* `description`, `version`, `_meta` and `deprecated` are all optional and are omitted from the saved json entirely when left blank/unset rather than being written out empty. `_meta` remains a free-form optional JSON editor, since it's arbitrary user metadata rather than a fixed schema.

`/Elastic_Source/Index_Templates/` - this folder contains a set of json files, each of which defines an Elasticsearch index template. Each template is defined in a json file named the same as the template's `name` attribute, eg `/Elastic_Source/Index_Templates/logs-myapp.json`.

The structure of the json follows the request body of the [Put Index Template API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-put-index-template) directly (there's no wrapper key), with `name` added at the top level since the API takes the template name from the URL path rather than the body:
```json
{
  "name": "logs-myapp",
  "index_patterns": ["logs-myapp-*"],
  "composed_of": ["logs-mappings", "logs-settings"],
  "priority": 200,
  "version": 1,
  "data_stream": {
    "hidden": false
  },
  "allow_auto_create": true,
  "template": {
    "settings": {
      "number_of_shards": 1
    },
    "mappings": {
      "properties": {
        "message": { "type": "text" }
      }
    }
  },
  "_meta": {
    "managed_by": "cmt"
  }
}
```
* The file name must be the same as the `name` attribute.
* Every field with a fixed, bounded shape is edited as a structured control rather than raw JSON (see `src/editors/indexTemplateEditorPanel.ts`):
  * **Index Patterns** (required, at least one) and **Composed Of** / **Ignore Missing Component Templates** (both optional) are each edited as a newline-separated list, one entry per line, mirroring the stringArray field convention used elsewhere in this project.
  * **Priority** and **Version** are optional numeric fields.
  * **Allow Auto Create** is a three-way dropdown - "(default)" (omitted from the saved json, letting the cluster setting apply), "True" or "False" - since Elasticsearch treats "unset" as meaningfully different from an explicit `false`.
  * **Data Stream Template** is a checkbox that toggles whether a `data_stream` object is saved at all; when enabled, its own **Hidden** and **Allow Custom Routing** checkboxes are shown.
  * **Deprecated** is a plain checkbox.
* `template.settings`, `template.mappings` and `template.aliases` are each edited as structured controls too (see `src/indexTemplates/settingsTemplate.ts`, `mappingsTemplate.ts`, `aliasesTemplate.ts`), following the same curated-fields-plus-JSON-escape-hatch pattern used for ILM phases/actions and Ingest processors, since each of these three sub-schemas is open-ended in its own way and can't be fully curated without risking data loss. Each of the three is wrapped in its own collapsible section with an **Include** checkbox in the section header: unchecked, the section's structured input is hidden and excluded from the saved `template` object entirely (any values left in its now-hidden fields are ignored and not validated); checked, the section's fields become visible and the section can be freely expanded/collapsed like any other collapsible section in this project.
  * **Settings** - a curated set of the most commonly used index settings (Number of Shards, Number of Replicas, Refresh Interval, Codec, ILM Policy Name i.e. `index.lifecycle.name`, Total Fields Limit), plus an **Advanced Settings** JSON field for anything else. On save, curated field values are merged on top of the Advanced Settings object (curated values win on key collision). Settings loaded from disk that don't match one of the curated flat keys exactly (e.g. a differently-shaped or nested settings object) round-trip through Advanced Settings rather than being lost.
  * **Mappings** - **Dynamic** (dropdown: default/true/false/strict) and **Disable _source** (checkbox) at the top level, plus a repeatable list of top-level **Fields** (`properties`). Each field row has a **Field Name** and a **Type** dropdown covering the most common field types (`text`, `keyword`, `long`, `integer`, `short`, `byte`, `double`, `float`, `boolean`, `date`, `ip`, `geo_point`, `object`, `nested`, `binary`, `flattened`), each with their own curated options where relevant (`text`: Analyzer + "Add Keyword Sub-field"; `keyword`: Ignore Above; `date`: Format). A final **Custom / Other...** option covers any other field type (e.g. `dense_vector`, `search_as_you_type`, `constant_keyword`) with a free-text **Field Type** name plus a JSON **Configuration** object for that type's own parameters - this is also what a field needing nested `properties` (for `object`/`nested` types) or multi-fields beyond the single curated keyword sub-field must use, and what any field with an uncurated type falls back to when reopened, so no data is lost.
  * **Aliases** - a repeatable list of alias rows, each with an **Alias Name**, **Is Write Index** / **Is Hidden** checkboxes, an optional **Routing** field, and an optional **Filter** JSON field for the alias's Query DSL filter (left as JSON since query DSL is itself open-ended, the same rationale as `_meta`).
* `_meta` remains a free-form optional JSON editor, since it's arbitrary user metadata rather than a fixed schema.

`/Elastic_Source/Roles/` - this folder contains a set of json files, each of which defines an Elasticsearch security role. Each role is defined in a json file named the same as the role's name, eg `/Elastic_Source/Roles/cmt_read_only.json`.

The structure of the json matches the response body of the [Get Role API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-get-role): the role's name is the single root JSON key, and its value is the rest of the [Put Role API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role) request body (the API itself takes the name from the URL path rather than the body):
```json
{
  "cmt_read_only": {
    "description": "Read-only access to CMT logs/metrics.",
    "cluster": ["monitor"],
    "indices": [
      {
        "names": ["logs-cmt-*", "metrics-cmt-*"],
        "privileges": ["read", "view_index_metadata"],
        "field_security": {
          "grant": ["*"],
          "except": ["secrets.*"]
        },
        "query": "{\"match\": {\"tenant\": \"cmt\"}}"
      }
    ],
    "applications": [
      { "application": "kibana-.kibana", "privileges": ["read"], "resources": ["*"] }
    ],
    "run_as": ["cmt_service_account"],
    "metadata": {
      "managed_by": "cmt"
    }
  }
}
```
* The file name must be the same as the root JSON key (the role's name).
* Every field with a fixed, bounded shape is edited as a structured control rather than raw JSON (see `src/editors/roleEditorPanel.ts` and `src/roles/rolePrivilegeTemplates.ts`):
  * **Description** is an optional free-text field.
  * **Cluster Privileges** and **Run As** are each edited as a newline-separated list, one entry per line, mirroring the stringArray field convention used elsewhere in this project (e.g. Index Template's Index Patterns) rather than a fixed dropdown, since Elasticsearch's set of recognized cluster privilege names is large and evolves across versions.
  * **Index Privileges** (`indices`) and **Remote Index Privileges** (`remote_indices`) are each a repeatable list of rows sharing the same structure - Remote Index Privileges add a required **Clusters** list on top - with: **Index Names/Patterns** and **Privileges** (both required newline-separated lists), an **Allow Restricted Indices** checkbox, optional **Field Security: Grant** / **Field Security: Except** newline-separated field-name lists, and an optional **Query** JSON field for the privilege's Query DSL filter (left as JSON, the same open-ended-schema rationale as Index Template alias filters).
  * **Application Privileges** (`applications`) are a repeatable list of rows, each with a required **Application** name, and required **Privileges** / **Resources** lists.
  * **Remote Cluster Privileges** (`remote_cluster`) are a repeatable list of rows, each with required **Clusters** and **Privileges** lists.
  * Any row-based list may be left empty (the corresponding key is omitted from the saved json entirely), but any row that's present must have its required fields filled in before saving.
* **Metadata** (`metadata`) remains a free-form optional JSON editor, since it's arbitrary user metadata rather than a fixed schema (the same rationale as `_meta` elsewhere in this project).
* **Global Privileges** (`global`) also remains a free-form optional JSON editor, since Elasticsearch's "global"/conditional privilege shape (e.g. nested application-management conditions) is itself open-ended and not practical to curate.

`/Elastic_Source/Role_Mappings/` - this folder contains a set of json files, each of which defines an Elasticsearch role mapping, associating authenticated users with roles based on matching rules. Each role mapping is defined in a json file named the same as its name, eg `/Elastic_Source/Role_Mappings/cmt_ldap_admins.json`.

The structure of the json matches the response body of the [Get Role Mapping API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-get-role-mapping): the role mapping's `name` is the single root JSON key, and its value is the rest of the [Put Role Mapping API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role-mapping) request body (the API itself takes the name from the URL path rather than the body):
```json
{
  "cmt_ldap_admins": {
    "enabled": true,
    "roles": ["cmt_read_only"],
    "role_templates": [
      { "template": { "source": "{{#tokenize \"groups\"}}{{.}}{{/tokenize}}" }, "format": "json" }
    ],
    "rules": {
      "all": [
        { "field": { "realm.name": "ldap1" } },
        { "field": { "groups": "cn=admins,dc=example,dc=com" } }
      ]
    },
    "metadata": {
      "managed_by": "cmt"
    }
  }
}
```
* The file name must be the same as the root JSON key (the role mapping's name).
* **Enabled** is a checkbox, checked by default (Elasticsearch's own default); it's omitted from the saved json when checked and only written out as an explicit `false` when unchecked.
* **Roles** is an optional newline-separated list of existing role names, mirroring the stringArray convention used for Role's Cluster Privileges/Run As.
* **Role Templates** (`role_templates`) is a repeatable list of rows, each with a required **Template** (a Mustache template string, saved as `{"source": "<template>"}`) and an optional **Format** dropdown (`(default)` / `string` / `json`) - an alternative to a fixed Roles list for computing role names dynamically from user attributes (see `src/roleMappings/roleTemplateRowTemplate.ts`).
* At least one of **Roles** or **Role Templates** must be provided before saving, since a mapping that grants nothing has no effect.
* **Rules** (`rules`) is a required JSON object - Elasticsearch's rule tree is a genuinely recursive/open-ended boolean expression (`field`, `except`, `all`, `any`), much like a Query DSL object, so unlike the rest of this shape it isn't practical to curate as structured fields and is left as a JSON editor.
* **Metadata** (`metadata`) remains a free-form optional JSON editor, since it's arbitrary user metadata rather than a fixed schema (the same rationale as `_meta`/Role's `metadata` elsewhere in this project).

`/Elastic_Source/Spaces/` - this folder contains a set of json files, each of which defines a Kibana space. Each space is defined in a json file named the same as the space's `id`, eg `/Elastic_Source/Spaces/marketing.json`.

The structure of the json follows the request body of the [Create Space API](https://www.elastic.co/docs/api/doc/kibana/operation/operation-post-spaces-space) directly (there's no wrapper key). Unlike most other artifact types in this project, both `id` and `name` are genuinely part of the body - Kibana spaces don't take their id from the URL path on create - `id` being the space's URL-safe identifier (and, per this project's convention, what drives the saved file name) and `name` its display label:
```json
{
  "id": "marketing",
  "name": "Marketing",
  "description": "This is the Marketing space.",
  "color": "#aabbcc",
  "initials": "MK",
  "disabledFeatures": ["discover"]
}
```
* The file name must be the same as the `id` attribute (not `name`).
* **ID** is a required free-text field validated client-side against Kibana's allowed charset (lowercase letters, digits, underscores and hyphens only), since it's used directly in Kibana URLs and as this space's file name.
* **Name** is a required free-text field for the space's display label in Kibana; unlike every other artifact type in this project, it doesn't drive the file name.
* **Description**, **Color**, **Initials** and **Avatar Image URL** are all optional free-text fields; **Color** and **Initials** are validated client-side (a `#rrggbb` hex value, and at most 2 characters, respectively) to match Kibana's own constraints.
* **Disabled Features** (`disabledFeatures`) is an optional newline-separated list of Kibana feature ids, mirroring the stringArray convention used elsewhere in this project, since the set of registered feature ids is plugin-defined and open-ended.

`/Elastic_Source/SnapshotPolicies/` - this folder contains a set of json files, each of which defines an Elasticsearch Snapshot Lifecycle Management (SLM) policy. Each policy is defined in a json file named the same as its policy id, eg `/Elastic_Source/SnapshotPolicies/daily-snapshots.json`.

The structure of the json follows this project's named-wrapper convention (the same one used by Roles and Role Mappings): the policy id is the single root JSON key, and its value is exactly the request body of the [Put Snapshot Lifecycle Policy API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-slm-put-lifecycle) (the API itself takes the policy id from the URL path, not the body). Note the body's own `name` field is unrelated to the policy id - it's the (optionally date-math-templated) name given to each snapshot the policy creates, e.g. `<daily-snap-{now/d}>`:
```json
{
  "daily-snapshots": {
    "schedule": "0 30 1 * * ?",
    "name": "<daily-snap-{now/d}>",
    "repository": "my_repository",
    "config": {
      "indices": ["data-*"],
      "ignore_unavailable": false,
      "include_global_state": false
    },
    "retention": {
      "expire_after": "30d",
      "min_count": 5,
      "max_count": 50
    }
  }
}
```
* The file name must be the same as the root JSON key (the policy id) - deliberately not called `name` in the form/model here, to avoid confusion with the body's own unrelated `name` field.
* **Policy ID**, **Schedule** and **Repository** are required free-text fields; **Policy ID** is validated client-side as a valid file name, the same rule used for every other file-name-driving field in this project.
* **Snapshot Name** (`name`) is a required free-text field - the (optionally templated) name given to each snapshot taken by this policy.
* **Config** (`config`) and **Retention** (`retention`) both remain free-form optional JSON editors, since their own sub-fields (`indices`/`ignore_unavailable`/`include_global_state`/`feature_states`/`partial`/`metadata` and `expire_after`/`min_count`/`max_count` respectively) are still evolving, the same rationale used for ILM policy phases elsewhere in this project.

`/Elastic_Source/Connections/` - this folder contains a set of json files, each of which is this extension's own record of an Elastic Cloud deployment to connect to (not a request body for any Elastic API). Each connection is defined in a json file named the same as its own generated `id`, eg `/Elastic_Source/Connections/3fa2....json`.

```json
{
  "id": "3fa2c1e0-...",
  "name": "Staging Deployment",
  "cloudId": "staging:dXMtZWFzdC0xLmF3cy5mb3VuZC5pbyRhYmNkMTIzNCRlZmdoNTY3OA=="
}
```
* The file name must be the same as the `id` attribute. Unlike every other artifact type in this project, `id` isn't user-entered - it's generated once when the connection is first saved (`generateId()` in `fileSystem.ts`) and never changes, since it also doubles as the SecretStorage key for the API key (see below).
* **Name** is a required free-text display name.
* **Cloud ID** is a required free-text field - the deployment's Cloud ID, copied from the "Copy Cloud ID" action in the Elastic Cloud console. It's validated on save by decoding it (`src/connections/cloudId.ts`) into the deployment's Elasticsearch and Kibana endpoint URLs.
* **API Key** is a required field only when creating a new connection (optional, and left blank, when editing one - blank means "keep the currently stored key"). It is deliberately **not** part of this JSON shape and is never written to disk: it's stored in VS Code's [SecretStorage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage), keyed by the connection's `id` (`src/connections/connectionManager.ts`).

Expanding a saved connection in the tree shows two live nodes, both backed by `src/connections/kibanaClient.ts` using the stored API key, listing their items read-only - unlike every other artifact type in this project, none of this is saved as local files, and clicking an item opens a read-only view rather than an editable form:
* **Spaces**, which fetches that deployment's Kibana Spaces live via the [Get All Spaces API](https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-spaces-space).
* **Fleet Agent Policies**, which fetches that deployment's Fleet Agent Policies live via the [Get Agent Policies API](https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-fleet-agent-policies) (a single `perPage=100` page rather than following pagination, since this is a read-only browse view). It reuses the same `FleetAgentPolicy` shape as the local `Fleet_Agent_Policies/` artifact type (see above), and its read-only view does not show that type's Integration Policies, since those aren't exposed by this endpoint.

Each live Space/Fleet Agent Policy row also has an inline **Download to Project** action (`src/repositories.ts`'s `downloadSpace`/`downloadAgentPolicy`, wired up in `src/extension.ts`) - the one place this project's usual direction (local file → applied to a deployment) runs in reverse. It saves the live item as a normal local artifact under `Spaces/`/`Fleet_Agent_Policies/`, using the exact same `saveSpace`/`saveFleetAgentPolicy` functions and file-naming conventions the structured editors use, after stripping the live API response down to the known fields (a real Kibana response can carry extra fields - e.g. a built-in Space's `_reserved` flag - that aren't part of this project's curated shape). If a local artifact with that id/name already exists, the user is prompted to confirm before it's overwritten (mirroring the confirmation modal `elasticSource.deleteArtifact` already uses). A downloaded Fleet Agent Policy's `name` is validated the same way the local "New Fleet Agent Policy" form validates one (`validateArtifactName`), since unlike a Kibana space id, Kibana doesn't constrain a policy name to filesystem-safe characters.

Before that validation runs, a downloaded Fleet Agent Policy's live name is first passed through `extractAgentPolicyName` (`src/repositories.ts`), which applies the `elasticSource.agentPolicyNamePattern` regex (default `(.*)\s\|\s.*`, see `getAgentPolicyNamePattern` in `src/config.ts`) and, if it matches, uses capture group 1 as the name instead of the full live name - e.g. `Agent Policy1 | Test` downloads as `Agent Policy1`, letting the same policy pulled from several environments (`... | Test`, `... | Prod`) land under one consistent local name rather than one folder per environment. The policy's own `id` is left untouched either way - only the locally-facing `name` (and therefore the folder/file name) is affected. If the pattern doesn't match, or the setting holds invalid regex syntax, the full original live name is used unchanged rather than failing the download.