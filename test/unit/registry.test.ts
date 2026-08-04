import {
  getIntegrationTemplateChoices,
  integrationPackageTemplates,
  resolveIntegrationTemplate,
} from '../../src/integrations/registry';
import { apachePackageTemplate_2_0_0 } from '../../src/integrations/apachePackage_2_0_0';
import { nginxPackageTemplate_3_2_1 } from '../../src/integrations/nginxPackage_3_2_1';
import { nginxPackageTemplate_2_0_0 } from '../../src/integrations/nginxPackage_2_0_0';
import { systemPackageTemplate_2_22_1 } from '../../src/integrations/systemPackage_2_22_1';
import { systemPackageTemplate_2_3_2 } from '../../src/integrations/systemPackage_2_3_2';
import { systemPackageTemplate_2_6_3 } from '../../src/integrations/systemPackage_2_6_3';

describe('getIntegrationTemplateChoices', () => {
  it('lists every registered (name, version) template, including multiple versions of the same package', () => {
    const choices = getIntegrationTemplateChoices();
    expect(choices).toEqual(
      expect.arrayContaining([
        { id: 'system', label: 'System', description: 'v2.22.1', version: '2.22.1' },
        { id: 'system', label: 'System', description: 'v2.6.3', version: '2.6.3' },
        { id: 'system', label: 'System', description: 'v2.3.2', version: '2.3.2' },
        { id: 'nginx', label: 'Nginx', description: 'v3.2.1', version: '3.2.1' },
        { id: 'nginx', label: 'Nginx', description: 'v2.0.0', version: '2.0.0' },
        { id: 'apache', label: 'Apache HTTP Server', description: 'v2.0.0', version: '2.0.0' },
      ])
    );
    const totalTemplates = Object.values(integrationPackageTemplates).reduce((n, ts) => n + ts.length, 0);
    expect(choices).toHaveLength(totalTemplates);
  });
});

describe('resolveIntegrationTemplate', () => {
  it('resolves "apache" by name only, since only one template is registered for it', () => {
    expect(resolveIntegrationTemplate('apache')).toBe(apachePackageTemplate_2_0_0);
  });

  it('returns undefined for "system" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('system')).toBeUndefined();
  });

  it('returns undefined for "nginx" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('nginx')).toBeUndefined();
  });

  it('resolves "system" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('system', '2.22.1')).toBe(systemPackageTemplate_2_22_1);
    expect(resolveIntegrationTemplate('system', '2.6.3')).toBe(systemPackageTemplate_2_6_3);
    expect(resolveIntegrationTemplate('system', '2.3.2')).toBe(systemPackageTemplate_2_3_2);
  });

  it('resolves "nginx" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('nginx', '3.2.1')).toBe(nginxPackageTemplate_3_2_1);
    expect(resolveIntegrationTemplate('nginx', '2.0.0')).toBe(nginxPackageTemplate_2_0_0);
  });

  it('resolves by name and version when the version matches the registered template', () => {
    expect(resolveIntegrationTemplate('apache', apachePackageTemplate_2_0_0.version)).toBe(apachePackageTemplate_2_0_0);
  });

  it('returns undefined for an unknown package name, rather than falling back to some other template', () => {
    expect(resolveIntegrationTemplate('does-not-exist')).toBeUndefined();
  });

  it('returns undefined when a known package is at a version with no matching template', () => {
    expect(resolveIntegrationTemplate('nginx', '999.0.0')).toBeUndefined();
    expect(resolveIntegrationTemplate('system', '999.0.0')).toBeUndefined();
  });
});
