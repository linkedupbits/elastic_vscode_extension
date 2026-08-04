import * as vscode from 'vscode';
import { FleetAgentPolicy, FleetPackagePolicy, SpaceDefinition } from '../models';

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
      /** For a `connection-agentpolicy`/`connection-integrationpolicy` node: the display name of the connection it was fetched from, used to label its view. */
      connectionName?: string;
      /**
       * For a `connection-space` leaf: the live space data fetched to render it, used by the
       * "Download to Project" command. Also set on a `connection-agentpolicies-space` node -
       * the space its children's `fetchAgentPolicies`/`fetchPackagePolicies` calls are scoped to.
       */
      liveSpace?: SpaceDefinition;
      /** For a `connection-agentpolicy`/`connection-integrationpolicy` node: the id of the space its `connection-agentpolicies-space` ancestor was fetched under. An agent policy can be assigned to more than one space, so this - not `liveAgentPolicy.id` alone - is what makes it uniquely identifiable within the tree. */
      liveSpaceId?: string;
      /** For a `connection-agentpolicy` node: the live policy data fetched to render it. Also set on its `connection-integrationpolicy` children, identifying which agent policy they're assigned to for the "Download to Project" command. */
      liveAgentPolicy?: FleetAgentPolicy;
      /** For a `connection-agentpolicy` node: the live integration policies already assigned to it (via `policy_id`/`policy_ids`), rendered as its children on expansion. */
      liveIntegrationPolicies?: FleetPackagePolicy[];
      /** For a `connection-integrationpolicy` leaf: the live integration policy data fetched to render it, used by the view and "Download to Project" commands. */
      liveIntegrationPolicy?: FleetPackagePolicy;
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
    this.connectionName = options.connectionName;
    this.liveSpace = options.liveSpace;
    this.liveSpaceId = options.liveSpaceId;
    this.liveAgentPolicy = options.liveAgentPolicy;
    this.liveIntegrationPolicies = options.liveIntegrationPolicies;
    this.liveIntegrationPolicy = options.liveIntegrationPolicy;
  }

  filePath?: string;
  artifactType?: ArtifactType;
  connectionId?: string;
  connectionName?: string;
  liveSpace?: SpaceDefinition;
  liveSpaceId?: string;
  liveAgentPolicy?: FleetAgentPolicy;
  liveIntegrationPolicies?: FleetPackagePolicy[];
  liveIntegrationPolicy?: FleetPackagePolicy;
}
