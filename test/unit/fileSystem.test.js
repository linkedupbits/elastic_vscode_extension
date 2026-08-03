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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fileSystem_1 = require("../../src/fileSystem");
const tempDir_1 = require("../helpers/tempDir");
describe('generateId', () => {
    it('returns a v4-shaped UUID', () => {
        const id = (0, fileSystem_1.generateId)();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
    it('is unique across calls', () => {
        const ids = new Set(Array.from({ length: 50 }, () => (0, fileSystem_1.generateId)()));
        expect(ids.size).toBe(50);
    });
});
describe('validateArtifactName', () => {
    it.each(['CMT Default', 'system-cmt-default', 'a', 'Name With Spaces 123'])('accepts %p', (name) => {
        expect((0, fileSystem_1.validateArtifactName)(name)).toBeUndefined();
    });
    it('rejects an empty name', () => {
        expect((0, fileSystem_1.validateArtifactName)('')).toBe('Name is required.');
    });
    it('rejects a whitespace-only name', () => {
        expect((0, fileSystem_1.validateArtifactName)('   ')).toBe('Name is required.');
    });
    it.each([['back\\slash'], ['forward/slash'], ['co:lon'], ['sta*r'], ['quest?ion'], ['"quote'], ['<lt'], ['gt>'], ['pi|pe']])('rejects %p for containing a reserved filesystem character', (name) => {
        expect((0, fileSystem_1.validateArtifactName)(name)).toBe('Name cannot contain \\ / : * ? " < > |');
    });
    it.each(['.', '..'])('rejects the special path segment %p', (name) => {
        expect((0, fileSystem_1.validateArtifactName)(name)).toBe('Name is not valid.');
    });
    it('rejects leading/trailing whitespace', () => {
        expect((0, fileSystem_1.validateArtifactName)(' Padded')).toBe('Name cannot have leading or trailing whitespace.');
        expect((0, fileSystem_1.validateArtifactName)('Padded ')).toBe('Name cannot have leading or trailing whitespace.');
    });
});
describe('filesystem helpers', () => {
    let dir;
    beforeEach(() => {
        dir = (0, tempDir_1.makeTempDir)();
    });
    afterEach(() => {
        (0, tempDir_1.removeTempDir)(dir);
    });
    describe('pathExists', () => {
        it('is true for a path that exists and false otherwise', async () => {
            expect(await (0, fileSystem_1.pathExists)(dir)).toBe(true);
            expect(await (0, fileSystem_1.pathExists)(path.join(dir, 'nope'))).toBe(false);
        });
    });
    describe('ensureDir', () => {
        it('creates nested directories that do not yet exist', async () => {
            const nested = path.join(dir, 'a', 'b', 'c');
            await (0, fileSystem_1.ensureDir)(nested);
            expect(fs.existsSync(nested)).toBe(true);
        });
        it('is a no-op when the directory already exists', async () => {
            await (0, fileSystem_1.ensureDir)(dir);
            await expect((0, fileSystem_1.ensureDir)(dir)).resolves.toBeUndefined();
        });
    });
    describe('listJsonFiles', () => {
        it('returns [] for a directory that does not exist', async () => {
            expect(await (0, fileSystem_1.listJsonFiles)(path.join(dir, 'missing'))).toEqual([]);
        });
        it('lists only *.json files directly inside the directory', async () => {
            fs.writeFileSync(path.join(dir, 'a.json'), '{}');
            fs.writeFileSync(path.join(dir, 'b.JSON'), '{}');
            fs.writeFileSync(path.join(dir, 'c.txt'), 'not json');
            fs.mkdirSync(path.join(dir, 'subfolder'));
            fs.writeFileSync(path.join(dir, 'subfolder', 'nested.json'), '{}');
            const files = (await (0, fileSystem_1.listJsonFiles)(dir)).map((f) => path.basename(f)).sort();
            expect(files).toEqual(['a.json', 'b.JSON']);
        });
    });
    describe('listSubdirectories', () => {
        it('returns [] for a directory that does not exist', async () => {
            expect(await (0, fileSystem_1.listSubdirectories)(path.join(dir, 'missing'))).toEqual([]);
        });
        it('lists only immediate subdirectories, not files', async () => {
            fs.mkdirSync(path.join(dir, 'Policy A'));
            fs.mkdirSync(path.join(dir, 'Policy B'));
            fs.writeFileSync(path.join(dir, 'not-a-dir.json'), '{}');
            const subdirs = (await (0, fileSystem_1.listSubdirectories)(dir)).map((d) => path.basename(d)).sort();
            expect(subdirs).toEqual(['Policy A', 'Policy B']);
        });
    });
    describe('readJsonFile / writeJsonFile', () => {
        it('round-trips arbitrary JSON data', async () => {
            const filePath = path.join(dir, 'artifact.json');
            const data = { id: '123', name: 'Test', nested: { a: [1, 2, 3] } };
            await (0, fileSystem_1.writeJsonFile)(filePath, data);
            const read = await (0, fileSystem_1.readJsonFile)(filePath);
            expect(read).toEqual(data);
        });
        it('pretty-prints with a trailing newline', async () => {
            const filePath = path.join(dir, 'artifact.json');
            await (0, fileSystem_1.writeJsonFile)(filePath, { a: 1 });
            const raw = fs.readFileSync(filePath, 'utf8');
            expect(raw).toBe('{\n  "a": 1\n}\n');
        });
        it('creates missing parent directories on write', async () => {
            const filePath = path.join(dir, 'nested', 'deep', 'artifact.json');
            await (0, fileSystem_1.writeJsonFile)(filePath, { a: 1 });
            expect(fs.existsSync(filePath)).toBe(true);
        });
    });
    describe('deleteFile', () => {
        it('removes an existing file', async () => {
            const filePath = path.join(dir, 'gone.json');
            fs.writeFileSync(filePath, '{}');
            await (0, fileSystem_1.deleteFile)(filePath);
            expect(fs.existsSync(filePath)).toBe(false);
        });
        it('does not throw when the file does not exist', async () => {
            await expect((0, fileSystem_1.deleteFile)(path.join(dir, 'never-existed.json'))).resolves.toBeUndefined();
        });
    });
    describe('deleteFolderRecursive', () => {
        it('removes a directory and everything inside it', async () => {
            const sub = path.join(dir, 'Policy', 'Integrations');
            fs.mkdirSync(sub, { recursive: true });
            fs.writeFileSync(path.join(sub, 'x.json'), '{}');
            await (0, fileSystem_1.deleteFolderRecursive)(path.join(dir, 'Policy'));
            expect(fs.existsSync(path.join(dir, 'Policy'))).toBe(false);
        });
    });
    describe('renameFile', () => {
        it('moves a file to a new path, creating parent directories as needed', async () => {
            const oldPath = path.join(dir, 'old.json');
            const newPath = path.join(dir, 'renamed-folder', 'new.json');
            fs.writeFileSync(oldPath, '{"v":1}');
            await (0, fileSystem_1.renameFile)(oldPath, newPath);
            expect(fs.existsSync(oldPath)).toBe(false);
            expect(fs.readFileSync(newPath, 'utf8')).toBe('{"v":1}');
        });
    });
    describe('renameFolder', () => {
        it('moves a folder (and its contents) to a new path', async () => {
            const oldPath = path.join(dir, 'Old Name');
            const newPath = path.join(dir, 'New Name');
            fs.mkdirSync(oldPath);
            fs.writeFileSync(path.join(oldPath, 'Old Name.json'), '{}');
            await (0, fileSystem_1.renameFolder)(oldPath, newPath);
            expect(fs.existsSync(oldPath)).toBe(false);
            expect(fs.existsSync(path.join(newPath, 'Old Name.json'))).toBe(true);
        });
    });
});
//# sourceMappingURL=fileSystem.test.js.map