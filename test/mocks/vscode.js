"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewColumn = exports.Uri = exports.EventEmitter = exports.TreeItem = exports.ThemeIcon = exports.TreeItemCollapsibleState = exports.commands = exports.window = exports.workspace = void 0;
exports.__setWorkspaceFolders = __setWorkspaceFolders;
exports.__setConfigValue = __setConfigValue;
exports.__resetWorkspace = __resetWorkspace;
/**
 * Minimal runtime stand-in for the `vscode` module, used only by Jest (wired via
 * jest.config.js's moduleNameMapper). Type-checking still resolves `import * as vscode
 * from 'vscode'` against the real @types/vscode declarations — this file only needs to
 * behave correctly for the specific runtime operations our source actually performs
 * (constructing TreeItem/ThemeIcon/EventEmitter, reading workspace state), not satisfy
 * the full API surface.
 */
const path = __importStar(require("path"));
let workspaceFolders;
let configValues = {};
exports.workspace = {
    get workspaceFolders() {
        return workspaceFolders;
    },
    getConfiguration(_section) {
        return {
            get(key, defaultValue) {
                const value = configValues[key];
                return (value === undefined ? defaultValue : value);
            },
        };
    },
    onDidChangeConfiguration: () => ({ dispose: () => undefined }),
    onDidChangeWorkspaceFolders: () => ({ dispose: () => undefined }),
    createFileSystemWatcher: () => ({
        onDidCreate: () => ({ dispose: () => undefined }),
        onDidChange: () => ({ dispose: () => undefined }),
        onDidDelete: () => ({ dispose: () => undefined }),
        dispose: () => undefined,
    }),
};
/** Test helper: point the mocked workspace at a single root folder (or clear it). */
function __setWorkspaceFolders(root) {
    workspaceFolders = root === undefined ? undefined : [{ uri: { fsPath: root } }];
}
/** Test helper: set a single `elasticSource.<key>` configuration value. */
function __setConfigValue(key, value) {
    configValues[key] = value;
}
/** Test helper: reset all mocked workspace/config state between tests. */
function __resetWorkspace() {
    workspaceFolders = undefined;
    configValues = {};
}
// ---------- window / commands (unused by the modules under test, kept minimal) ----------
exports.window = {
    createWebviewPanel: () => {
        throw new Error('vscode.window.createWebviewPanel is not mocked; webview panels are out of unit-test scope.');
    },
    showWarningMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    showQuickPick: async () => undefined,
    registerTreeDataProvider: () => ({ dispose: () => undefined }),
};
exports.commands = {
    registerCommand: () => ({ dispose: () => undefined }),
    executeCommand: async () => undefined,
};
// ---------- tree view ----------
var TreeItemCollapsibleState;
(function (TreeItemCollapsibleState) {
    TreeItemCollapsibleState[TreeItemCollapsibleState["None"] = 0] = "None";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Collapsed"] = 1] = "Collapsed";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Expanded"] = 2] = "Expanded";
})(TreeItemCollapsibleState || (exports.TreeItemCollapsibleState = TreeItemCollapsibleState = {}));
class ThemeIcon {
    id;
    constructor(id) {
        this.id = id;
    }
}
exports.ThemeIcon = ThemeIcon;
class TreeItem {
    label;
    collapsibleState;
    contextValue;
    iconPath;
    description;
    tooltip;
    command;
    constructor(label, collapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}
exports.TreeItem = TreeItem;
class EventEmitter {
    listeners = [];
    event = (listener) => {
        this.listeners.push(listener);
        return { dispose: () => undefined };
    };
    fire(data) {
        for (const listener of this.listeners) {
            listener(data);
        }
    }
}
exports.EventEmitter = EventEmitter;
// ---------- Uri ----------
class Uri {
    fsPath;
    constructor(fsPath) {
        this.fsPath = fsPath;
    }
    static file(fsPath) {
        return new Uri(fsPath);
    }
    static joinPath(base, ...segments) {
        return new Uri(path.join(base.fsPath, ...segments));
    }
}
exports.Uri = Uri;
var ViewColumn;
(function (ViewColumn) {
    ViewColumn[ViewColumn["One"] = 1] = "One";
})(ViewColumn || (exports.ViewColumn = ViewColumn = {}));
//# sourceMappingURL=vscode.js.map