"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packageTemplate_1 = require("../../src/integrations/packageTemplate");
const systemPackage_1 = require("../../src/integrations/systemPackage");
const templateInvariants_1 = require("../helpers/templateInvariants");
function input(id) {
    const found = systemPackage_1.systemPackageTemplate.inputs.find((i) => i.id === id);
    if (!found)
        throw new Error(`no such input: ${id}`);
    return found;
}
function stream(inputId, streamId) {
    const found = input(inputId).streams.find((s) => s.id === streamId);
    if (!found)
        throw new Error(`no such stream: ${inputId}/${streamId}`);
    return found;
}
describe('systemPackageTemplate', () => {
    it('is structurally well-formed', () => {
        (0, templateInvariants_1.assertTemplateIsWellFormed)(systemPackage_1.systemPackageTemplate);
    });
    it('is package version 2.22.1, matching the current upstream manifest.yml', () => {
        expect(systemPackage_1.systemPackageTemplate.name).toBe('system');
        expect(systemPackage_1.systemPackageTemplate.version).toBe('2.22.1');
    });
    it('has the four input types System declares, keyed as <package>-<type>', () => {
        expect(systemPackage_1.systemPackageTemplate.inputs.map((i) => i.id).sort()).toEqual([
            'system-journald',
            'system-logfile',
            'system-system/metrics',
            'system-winlog',
        ]);
    });
    it('winlog has no input-level vars (matches manifest: no `vars:` key on that input type)', () => {
        expect(input('system-winlog').vars).toBeUndefined();
    });
    it('the metrics input has the system.hostfs var', () => {
        expect(input('system-system/metrics').vars?.map((f) => f.key)).toEqual(['system.hostfs']);
    });
    describe('the new `ntp` metrics stream', () => {
        it('exists and defaults to disabled, matching manifest enabled:false', () => {
            const ntp = stream('system-system/metrics', 'system.ntp');
            expect(ntp.defaultEnabled).toBe(false);
        });
        it('ntp.version is a required select with options "3" and "4"', () => {
            const ntp = stream('system-system/metrics', 'system.ntp');
            const version = ntp.vars.find((f) => f.key === 'ntp.version');
            expect(version?.type).toBe('select');
            expect(version?.required).toBe(true);
            expect(version?.options).toEqual([
                { value: '3', label: '3' },
                { value: '4', label: '4' },
            ]);
        });
        it('ntp.servers defaults to ["pool.ntp.org"] and is required', () => {
            const ntp = stream('system-system/metrics', 'system.ntp');
            const servers = ntp.vars.find((f) => f.key === 'ntp.servers');
            expect(servers?.default).toEqual(['pool.ntp.org']);
            expect(servers?.required).toBe(true);
        });
    });
    it('system.core now defaults to disabled, matching manifest enabled:false (was true pre-2.22.1)', () => {
        expect(stream('system-system/metrics', 'system.core').defaultEnabled).toBe(false);
    });
    it("syslog's default paths no longer include /var/log/maillog* (dropped upstream)", () => {
        const paths = stream('system-logfile', 'system.syslog').vars.find((f) => f.key === 'paths');
        expect(paths?.default).toEqual(['/var/log/messages*', '/var/log/syslog*', '/var/log/system*']);
    });
    it.each([
        ['system-logfile', 'system.auth'],
        ['system-logfile', 'system.syslog'],
        ['system-journald', 'system.auth'],
        ['system-journald', 'system.syslog'],
        ['system-system/metrics', 'system.core'],
        ['system-system/metrics', 'system.cpu'],
        ['system-system/metrics', 'system.diskio'],
        ['system-system/metrics', 'system.load'],
        ['system-system/metrics', 'system.memory'],
        ['system-system/metrics', 'system.network'],
        ['system-system/metrics', 'system.ntp'],
        ['system-system/metrics', 'system.process'],
        ['system-system/metrics', 'system.process.summary'],
        ['system-system/metrics', 'system.socket_summary'],
        ['system-system/metrics', 'system.uptime'],
    ])('%s / %s has a processors var', (inputId, streamId) => {
        expect(stream(inputId, streamId).vars.some((f) => f.key === 'processors')).toBe(true);
    });
    it.each(['system.application', 'system.security', 'system.system'])('%s (winlog) has event_id and processors vars', (streamId) => {
        const s = stream('system-winlog', streamId);
        expect(s.vars.some((f) => f.key === 'event_id')).toBe(true);
        expect(s.vars.some((f) => f.key === 'processors')).toBe(true);
    });
    describe('requiresRoot — only auth, syslog and diskio declare agent.privileges.root: true', () => {
        it.each([
            ['system-logfile', 'system.auth', true],
            ['system-logfile', 'system.syslog', true],
            ['system-journald', 'system.auth', true],
            ['system-journald', 'system.syslog', true],
            ['system-system/metrics', 'system.diskio', true],
            ['system-system/metrics', 'system.cpu', false],
            ['system-system/metrics', 'system.core', false],
            ['system-winlog', 'system.application', false],
        ])('%s / %s -> requiresRoot=%s', (inputId, streamId, expected) => {
            expect(Boolean(stream(inputId, streamId).requiresRoot)).toBe(expected);
        });
    });
    it('a brand-new System policy computes requires_root=true (auth/syslog enabled by default)', () => {
        const inputs = (0, packageTemplate_1.buildDefaultInputs)(systemPackage_1.systemPackageTemplate);
        expect((0, packageTemplate_1.computeRequiresRoot)(systemPackage_1.systemPackageTemplate, inputs)).toBe(true);
    });
    it('requires_root computes false once every root-needing stream is disabled', () => {
        const inputs = (0, packageTemplate_1.buildDefaultInputs)(systemPackage_1.systemPackageTemplate);
        inputs['system-logfile'].streams['system.auth'].enabled = false;
        inputs['system-logfile'].streams['system.syslog'].enabled = false;
        inputs['system-journald'].streams['system.auth'].enabled = false;
        inputs['system-journald'].streams['system.syslog'].enabled = false;
        inputs['system-system/metrics'].streams['system.diskio'].enabled = false;
        expect((0, packageTemplate_1.computeRequiresRoot)(systemPackage_1.systemPackageTemplate, inputs)).toBe(false);
    });
    it('the logfile/journald condition defaults are complementary (mutually exclusive OS matches)', () => {
        const logfileCondition = input('system-logfile').vars?.find((f) => f.key === 'condition')?.default;
        const journaldCondition = input('system-journald').vars?.find((f) => f.key === 'condition')?.default;
        expect(typeof logfileCondition).toBe('string');
        expect(typeof journaldCondition).toBe('string');
        expect(logfileCondition).toContain('!=');
        expect(journaldCondition).toContain('==');
    });
});
//# sourceMappingURL=systemPackage.test.js.map