import * as vscode from 'vscode';
import { FleetAgentPolicy, SpaceDefinition } from '../models';

export type ArtifactType =
  | 'proxy'
  | 'downloadsource'
  | 'agentpolicy'
  | 'integrationpolicy'
  | 'ilmpolicy'
  | 'ingestpipeline'
  | 'indextemplate'
  | 'role'
  | 'rolemapping'
  | 'space'
  | 'snapshotpolicy'
  | 'connection';

export class ElasticTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options: {
      contextValue: string;
      iconPath?: vscode.ThemeIcon;
      description?: string;
      tooltip?: string;
      command?: vscode.Command;
      /** Absolute path to the artifact's json file. */
      filePath?: string;
      /** Which artifact editor this item should open. */
      artifactType?: ArtifactType;
      /** For a `connection`/`connection-spaces`/`connection-agentpolicies` node: the id of the connection it belongs to, used to look up its stored API key. */
      connectionId?: string;
      /** For a `connection-space` leaf: the live space data fetched to render it, used by the "Download to Project" command. */
      liveSpace?: SpaceDefinition;
      /** For a `connection-agentpolicy` leaf: the live policy data fetched to render it, used by the "Download to Project" command. */
      liveAgentPolicy?: FleetAgentPolicy;
    }
  ) {
    super(label, collapsibleState);
    this.contextValue = options.contextValue;
    this.iconPath = options.iconPath;
    this.description = options.description;
    this.tooltip = options.tooltip ?? label;
    this.command = options.command;
    this.filePath = options.filePath;
    this.artifactType = options.artifactType;
    this.connectionId = options.connectionId;
    this.liveSpace = options.liveSpace;
    this.liveAgentPolicy = options.liveAgentPolicy;
  }

  filePath?: string;
  artifactType?: ArtifactType;
  connectionId?: string;
  liveSpace?: SpaceDefinition;
  liveAgentPolicy?: FleetAgentPolicy;
}
