import * as path from 'path';
import * as vscode from 'vscode';
import { readJsonFile, validateArtifactName } from '../fileSystem';
import { buildDefaultIntegrationPolicy, mergeInputsWithTemplate, PackageTemplate } from '../integrations/packageTemplate';
import { FleetAgentPolicy, IntegrationInputValue, IntegrationPolicy } from '../models';
import { saveIntegrationPolicy } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface IntegrationPolicyPayload {
  isNew: boolean;
  item: IntegrationPolicy;
  template: PackageTemplate;
  agentPolicy: { id: string; name: string };
}

function agentPolicyFilePathFor(integrationFilePath: string): string {
  // integrationFilePath = .../<Agent Policy>/Integrations/<name>.json
  const agentPolicyFolder = path.dirname(path.dirname(integrationFilePath));
  return path.join(agentPolicyFolder, `${path.basename(agentPolicyFolder)}.json`);
}

export class IntegrationPolicyEditorPanel extends ArtifactPanelBase {
  private readonly template: PackageTemplate;
  private readonly agentPolicyFilePath: string;

  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void,
    template: PackageTemplate,
    agentPolicyFilePath: string
  ) {
    super(
      extensionUri,
      'elasticSource.integrationPolicyEditor',
      filePath ? 'Integration Policy' : `New ${template.title} Integration`,
      filePath,
      'integrationPolicyForm.js'
    );
    this.template = template;
    this.agentPolicyFilePath = agentPolicyFilePath;
  }

  static openNew(
    extensionUri: vscode.Uri,
    refresh: () => void,
    agentPolicyFilePath: string,
    template: PackageTemplate
  ): void {
    new IntegrationPolicyEditorPanel(extensionUri, undefined, refresh, template, agentPolicyFilePath);
  }

  static openExisting(
    extensionUri: vscode.Uri,
    refresh: () => void,
    filePath: string,
    template: PackageTemplate
  ): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new IntegrationPolicyEditorPanel(extensionUri, filePath, refresh, template, agentPolicyFilePathFor(filePath));
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Integration Policy</h1>
    <p class="subtitle" id="subtitle"></p>
    <form id="form">
      <div class="field">
        <label>Integration Type</label>
        <input type="text" id="package-display" readonly />
      </div>
      <div class="field">
        <label>Agent Policy</label>
        <input type="text" id="agent-policy-display" readonly />
        <span class="hint">The policy_id / policy_ids values are set automatically to this agent policy.</span>
      </div>
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as this integration's file name within the agent policy folder.</span>
        <span class="error">Enter a name that is valid as a file name.</span>
      </div>
      <div class="field">
        <label for="namespace">Namespace</label>
        <input type="text" id="namespace" />
      </div>
      <div class="field">
        <label for="description">Description</label>
        <textarea id="description"></textarea>
      </div>
      <div id="inputs-container"></div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<IntegrationPolicyPayload> {
    const agentPolicy = await readJsonFile<FleetAgentPolicy>(this.agentPolicyFilePath);

    if (this.filePath) {
      const raw = await readJsonFile<IntegrationPolicy>(this.filePath);
      const item: IntegrationPolicy = {
        ...raw,
        inputs: mergeInputsWithTemplate(this.template, raw.inputs),
      };
      return { isNew: false, item, template: this.template, agentPolicy: { id: agentPolicy.id, name: agentPolicy.name } };
    }

    return {
      isNew: true,
      item: buildDefaultIntegrationPolicy(this.template, agentPolicy.id),
      template: this.template,
      agentPolicy: { id: agentPolicy.id, name: agentPolicy.name },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as IntegrationPolicy;
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    // policy linkage and package identity are structural, not user-editable — always
    // re-derive them server-side rather than trusting whatever the webview posted.
    const agentPolicy = await readJsonFile<FleetAgentPolicy>(this.agentPolicyFilePath);
    const inputs: Record<string, IntegrationInputValue> = mergeInputsWithTemplate(
      this.template,
      data.inputs
    );

    const toSave: IntegrationPolicy = {
      name,
      namespace: data.namespace ?? '',
      description: data.description ?? '',
      package: {
        name: this.template.name,
        title: this.template.title,
        version: this.template.version,
        requires_root: this.template.requiresRoot,
      },
      policy_id: agentPolicy.id,
      policy_ids: [agentPolicy.id],
      inputs,
      output_id: data.output_id ?? null,
      vars: data.vars ?? {},
    };

    const filePath = await saveIntegrationPolicy(this.filePath, this.agentPolicyFilePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
