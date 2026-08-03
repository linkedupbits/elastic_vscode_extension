// Deliberately imports the literal 'vscode' specifier (same as production source files), so
// Jest's moduleNameMapper resolves this to the exact same module instance the code under test
// uses — a relative import of test/mocks/vscode.ts resolves to a *separate* instance under
// Jest and would silently desync mutable state (workspace folders, config values, etc.).
import * as vscode from 'vscode';
import type * as VscodeMockModule from '../mocks/vscode';

export const vscodeMock = vscode as unknown as typeof VscodeMockModule;
