import * as vscode from 'vscode';

export type ArtifactType = 'proxy' | 'downloadsource' | 'agentpolicy';

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
      /** Absolute path to the artifact's json file (leaf items only). */
      filePath?: string;
      /** Which artifact editor this leaf item should open. */
      artifactType?: ArtifactType;
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
  }

  filePath?: string;
  artifactType?: ArtifactType;
}
