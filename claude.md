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

These are the currently supported Integration types
* System - https://github.com/elastic/integrations/blob/main/packages/system/manifest.yml
  * examples:
    * [system-cmt-default.json](examples/Integrations/System/system-cmt-default.json)
    * [system-cmt-timbre.json](examples/Integrations/System/system-cmt-timbre.json)
* Nginx - https://github.com/elastic/integrations/tree/main/packages/nginx (package version 3.2.1)
  * Inputs: `logfile` (streams: `access`, `error`) and `nginx/metrics` (stream: `stubstatus`).
  * No example instance file exists for this package; its default field values (paths, hosts, ignore_older, etc.) were taken directly from the package's `manifest.yml` and `data_stream/*/manifest.yml` files on GitHub.
  * `requires_root` is not declared by the manifest (unlike the System examples, which have it `true`); it is set to `false` since nginx log/metric collection does not need elevated host privileges.

Each supported Integration type is described as a structural template (inputs → streams → vars, with each var's type, default value, and whether it is `required`) rather than being hand-coded field by field, so adding another Integration type mainly means transcribing its package manifest into a new template.

Vars marked `required` in the source package manifest (e.g. Nginx's `paths`, `tags`, `hosts`, `period`, `server_status_path`) must be non-blank before saving, but only while their owning input/stream is enabled - a disabled input or stream is not required to have valid values.

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