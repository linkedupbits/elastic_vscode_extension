"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("../../src/integrations/registry");
const nginxPackage_1 = require("../../src/integrations/nginxPackage");
const systemPackage_1 = require("../../src/integrations/systemPackage");
describe('getIntegrationTemplateChoices', () => {
    it('lists every registered template with id/label/version', () => {
        const choices = (0, registry_1.getIntegrationTemplateChoices)();
        expect(choices).toEqual(expect.arrayContaining([
            { id: 'system', label: 'System', description: 'v2.22.1' },
            { id: 'nginx', label: 'Nginx', description: 'v3.2.1' },
        ]));
        expect(choices).toHaveLength(Object.keys(registry_1.integrationPackageTemplates).length);
    });
});
describe('resolveIntegrationTemplate', () => {
    it('resolves "system" and "nginx" to their respective templates', () => {
        expect((0, registry_1.resolveIntegrationTemplate)('system')).toBe(systemPackage_1.systemPackageTemplate);
        expect((0, registry_1.resolveIntegrationTemplate)('nginx')).toBe(nginxPackage_1.nginxPackageTemplate);
    });
    it('falls back to a registered template for an unknown package name, rather than throwing', () => {
        const fallback = (0, registry_1.resolveIntegrationTemplate)('does-not-exist');
        expect(Object.values(registry_1.integrationPackageTemplates)).toContain(fallback);
    });
});
//# sourceMappingURL=registry.test.js.map