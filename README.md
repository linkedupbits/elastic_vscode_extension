# Elastic Source Manager

A VS Code extension for managing Elastic Cloud / Elasticsearch run-time artifacts as
infrastructure-as-code — without needing to hand-edit the JSON payloads for every API.

It gives you a design-time experience roughly equivalent to managing a deployment via
Click-Ops in Kibana, but backed by plain JSON files you can commit, diff, and review like any
other code.

## What it does

- Adds an **Elastic Source** view to the Activity Bar, backed by the VS Code
  [Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view), so you can
  browse every artifact type as a category with its saved instances underneath.
- Selecting an artifact opens a **structured editor** (a webview form) instead of the raw
  JSON file — fields, dropdowns, checkboxes and repeatable rows map directly onto the shape
  of the corresponding Elasticsearch/Fleet API. Genuinely open-ended sub-structures (Query
  DSL filters, role-mapping rule trees, arbitrary metadata) are left as validated JSON
  editors rather than being force-fit into a rigid form.
- Saves land as `.json` files under a configurable project root, named after the artifact
  itself, ready to be applied to a real deployment by whatever tooling/pipeline you use for
  that (this extension only manages the source-of-truth files, it does not call the
  Elasticsearch/Fleet APIs itself).

![alt text](docs/explorer.png)

## Supported artifact types

All artifacts live under a single project root folder (`Elastic_Source` by default, see
[Configuration](#configuration)):

| Folder | Artifact | API reference |
| --- | --- | --- |
| `Fleet_Proxies/` | Fleet proxy servers | — |
| `Fleet_Download_Sources/` | Fleet artifact download sources | — |
| `Fleet_Agent_Policies/<name>/<name>.json` | Fleet Agent Policies | [Create Agent Policies](https://www.elastic.co/docs/api/doc/serverless/operation/operation-post-fleet-agent-policies) |
| `Fleet_Agent_Policies/<name>/Integrations/*.json` | Integration Policies (System, Nginx) | package manifests on [elastic/integrations](https://github.com/elastic/integrations) |
| `Index_Lifecycle_Policies/` | ILM Policies | [Put Lifecycle](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ilm-put-lifecycle) |
| `Ingest_Pipelines/` | Ingest Pipelines | [Put Pipeline](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ingest-put-pipeline) |
| `Index_Templates/` | Index Templates | [Put Index Template](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-put-index-template) |
| `Roles/` | Security Roles | [Put Role](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role) |
| `Role_Mappings/` | Security Role Mappings | [Put Role Mapping](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role-mapping) |
| `Spaces/` | Kibana Spaces | [Create Space](https://www.elastic.co/docs/api/doc/kibana/operation/operation-post-spaces-space) |

Each JSON file is named after the artifact's own `name` (or, for Agent Policies, the owning
folder name too) and maps directly onto the request body of the linked API, with `name`
added at the top level since most of these APIs take the name from the URL path rather than
the body.

See [`claude.md`](claude.md) for the full field-by-field breakdown of every artifact type,
including which fields are curated into structured controls vs. left as JSON escape hatches
and why.

## Requirements

- [Node.js](https://nodejs.org/) (LTS) and npm
- VS Code `^1.85.0` or later

If you're setting up a fresh machine, see [`Prerequisites.md`](Prerequisites.md) for
installing `nvm`/Node and the Yeoman VS Code extension generator.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Open this folder in VS Code and press `F5` (or **Run and Debug → Run Extension**) to
   launch an Extension Development Host with the extension loaded.
3. In that host window, open a folder to act as your workspace, then use the **Elastic
   Source** icon in the Activity Bar to browse/create artifacts. An `Elastic_Source` folder
   (or whatever you've configured, see below) will be created on first save.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `elasticSource.rootFolder` | `Elastic_Source` | Path, relative to the workspace root, of the project folder containing all artifact subfolders. |

## Development

```bash
npm run compile       # tsc -p ./
npm run watch         # tsc -watch -p ./
npm test              # run the Jest unit test suite
npm run test:coverage # run tests with a coverage report
```

This project maintains 100% statement/branch/function/line coverage on every file under
`src/`, including the webview editor panels (via a mocked `vscode` module and a fake
webview message handshake in `test/`).

## Packaging

```bash
npm run package
```

This runs `vsce package`, producing an installable `elastic-source-manager-<version>.vsix`
in the project root. Install it via the Extensions view's **Install from VSIX...** command,
or:

```bash
code --install-extension elastic-source-manager-<version>.vsix
```

## License

[BSD 3-Clause](LICENSE)
