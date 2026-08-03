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

`/Elastic_Source/Ingest_Pipelines/` - this folder contains a set of json files, each of which defines an Elasticsearch ingest pipeline. Each pipeline is defined in a json file named the same as the pipeline's `name` attribute, eg `/Elastic_Source/Ingest_Pipelines/logs-emailengine_wildfly@custom.json`.

The structure of the json follows the request body of the [Put Pipeline API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ingest-put-pipeline) directly (there's no wrapper key, unlike the ILM policy body), with `name` added at the top level since the API takes the pipeline name/id from the URL path rather than the body:
```json
{
  "name": "logs-emailengine_wildfly@custom",
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
* The file name must be the same as the `name` attribute.
* `processors` is required (at least one) and `on_failure` is optional; both are edited as an ordered, repeatable list of structured processor rows (add/remove freely) rather than raw JSON, mirroring the inputs/streams/vars template pattern used for Integration Policies (see `src/ingest/ingestProcessorTemplate.ts`). Each row has:
  * A **Processor Type** dropdown covering a curated set of the most commonly used processor types: `set`, `remove`, `rename`, `append`, `convert`, `gsub`, `grok`, `dissect`, `date`, `json`, `script`, `pipeline`, `csv`, `kv`, `lowercase`, `uppercase`, `trim`, `split`, `geoip`, `user_agent`, `fail`, `drop` - each with its own structured fields (required ones enforced before saving).
  * A final **Custom / Other...** option for any processor type not in that curated list (e.g. `enrich`, plugin-provided processors, or future processor types), which instead exposes a free-text **Processor Type** name plus a JSON **Configuration** object for that type's parameters - this is also what any pipeline containing an uncurated processor type falls back to when reopened, so no data is lost.
  * Common **Tag**, **Condition** (Painless `if`) and **Ignore Failure** fields, supported by every processor type per the Put Pipeline API and rendered the same way regardless of which type is selected.
* `description`, `version`, `_meta` and `deprecated` are all optional and are omitted from the saved json entirely when left blank/unset rather than being written out empty. `_meta` remains a free-form optional JSON editor, since it's arbitrary user metadata rather than a fixed schema.