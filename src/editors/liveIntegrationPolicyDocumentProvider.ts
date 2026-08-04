import * as vscode from 'vscode';
import { InputDef, PackageTemplate, StreamDef, VarFieldDef } from '../integrations/packageTemplate';
import { resolveIntegrationTemplate } from '../integrations/registry';
import { FleetPackagePolicy, IntegrationInputValue, IntegrationStreamValue, VarValue } from '../models';

/** Custom scheme for the read-only "virtual document" a live integration policy opens as - see `LiveIntegrationPolicyDocumentProvider`. */
export const LIVE_INTEGRATION_POLICY_SCHEME = 'elastic-live-integration-policy';

/** Escapes a value for safe interpolation into a markdown table cell or backtick span. */
function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, "'");
}

function formatVarValue(value: VarValue | undefined): string {
  if (value === undefined || value === null) {
    return '_(not set)_';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((v) => `\`${escapeMarkdown(String(v))}\``).join(', ') : '_(empty)_';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  const text = String(value);
  return text.trim() === '' ? '_(empty)_' : `\`${escapeMarkdown(text)}\``;
}

function renderFieldsTable(fields: VarFieldDef[], values: Record<string, VarValue> | undefined): string[] {
  if (fields.length === 0) {
    return [];
  }
  return [
    '',
    '| Setting | Value |',
    '| --- | --- |',
    ...fields.map((f) => `| ${escapeMarkdown(f.label)}${f.required ? ' \\*' : ''} | ${formatVarValue(values?.[f.key])} |`),
  ];
}

function renderStream(stream: StreamDef, streamVal: IntegrationStreamValue | undefined): string[] {
  return [
    '',
    `### ${escapeMarkdown(stream.label)} ${streamVal?.enabled ? '✅ Enabled' : '⬜ Disabled'}`,
    ...renderFieldsTable(stream.vars, streamVal?.vars),
  ];
}

function renderInput(input: InputDef, inputVal: IntegrationInputValue | undefined): string[] {
  return [
    '',
    `## ${escapeMarkdown(input.label)} ${inputVal?.enabled ? '✅ Enabled' : '⬜ Disabled'}`,
    ...(input.vars ? renderFieldsTable(input.vars, inputVal?.vars) : []),
    ...input.streams.flatMap((stream) => renderStream(stream, inputVal?.streams?.[stream.id])),
  ];
}

/** Renders `policy.inputs` the same way the structured editor's form lays it out - one section per input, one subsection per stream - using the template's field labels. */
function renderTemplateBody(template: PackageTemplate, policy: FleetPackagePolicy): string {
  return template.inputs.flatMap((input) => renderInput(input, policy.inputs[input.id])).join('\n');
}

/** Fallback for a package with no registered structured-editor template: dumps inputs/vars as formatted JSON instead of guessing at field labels. */
function renderRawBody(policy: FleetPackagePolicy): string {
  return [
    '',
    '## Inputs',
    '',
    '```json',
    JSON.stringify(policy.inputs, null, 2),
    '```',
    ...(Object.keys(policy.vars ?? {}).length > 0
      ? ['', '## Vars', '', '```json', JSON.stringify(policy.vars, null, 2), '```']
      : []),
  ].join('\n');
}

function renderMarkdown(connectionName: string, policy: FleetPackagePolicy): string {
  const template = resolveIntegrationTemplate(policy.package?.name, policy.package?.version);
  const header = [
    `# ${escapeMarkdown(policy.name)}`,
    '',
    `*Live "${escapeMarkdown(policy.package?.title ?? policy.package?.name ?? '')}" (v${escapeMarkdown(
      policy.package?.version ?? ''
    )}) integration policy on "${escapeMarkdown(connectionName)}". Read-only - manage this policy in Kibana.*`,
    '',
    `- **Namespace:** ${policy.namespace || '_(default)_'}`,
    `- **Description:** ${policy.description || '_(none)_'}`,
    `- **Assigned to agent policy:** \`${escapeMarkdown(policy.policy_id)}\``,
  ].join('\n');
  const body = template ? renderTemplateBody(template, policy) : renderRawBody(policy);
  return `${header}\n${body}\n`;
}

/**
 * Serves a read-only markdown "virtual document" (no file on disk, via VS Code's
 * `TextDocumentContentProvider`) rendering a live integration policy's structured input screen -
 * the same input/stream/var layout the editable `IntegrationPolicyEditorPanel` form uses, but
 * flattened into markdown rather than a webview form, since there's no save flow to justify one
 * here. Virtual documents have no backing file to write to, so this is inherently read-only.
 * Content is looked up by the policy's live `id` (stashed by `uriFor`, called from the tree
 * item's open command) since the provider only ever receives the `Uri`, not the policy data.
 */
export class LiveIntegrationPolicyDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly policies = new Map<string, { connectionName: string; policy: FleetPackagePolicy }>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    const entry = this.policies.get(uri.query);
    if (!entry) {
      return `This integration policy is no longer available. Reopen it from the tree view.`;
    }
    return renderMarkdown(entry.connectionName, entry.policy);
  }

  /** Registers `policy` for lookup and returns the `Uri` to open it at. */
  uriFor(connectionName: string, policy: FleetPackagePolicy): vscode.Uri {
    this.policies.set(policy.id, { connectionName, policy });
    return vscode.Uri.from({
      scheme: LIVE_INTEGRATION_POLICY_SCHEME,
      path: `/${encodeURIComponent(policy.name)}.md`,
      query: policy.id,
    });
  }
}
