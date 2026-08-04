import {
  getIntegrationTemplateChoices,
  integrationPackageTemplates,
  resolveIntegrationTemplate,
} from '../../src/integrations/registry';
import { nginxPackageTemplate } from '../../src/integrations/nginxPackage';
import { systemPackageTemplate } from '../../src/integrations/systemPackage';
import { systemPackageTemplate_2_3_2 } from '../../src/integrations/systemPackage_2_3_2';

describe('getIntegrationTemplateChoices', () => {
  it('lists every registered (name, version) template, including multiple versions of the same package', () => {
    const choices = getIntegrationTemplateChoices();
    expect(choices).toEqual(
      expect.arrayContaining([
        { id: 'system', label: 'System', description: 'v2.22.1', version: '2.22.1' },
        { id: 'system', label: 'System', description: 'v2.3.2', version: '2.3.2' },
        { id: 'nginx', label: 'Nginx', description: 'v3.2.1', version: '3.2.1' },
      ])
    );
    const totalTemplates = Object.values(integrationPackageTemplates).reduce((n, ts) => n + ts.length, 0);
    expect(choices).toHaveLength(totalTemplates);
  });
});

describe('resolveIntegrationTemplate', () => {
  it('resolves "nginx" by name only, since only one template is registered for it', () => {
    expect(resolveIntegrationTemplate('nginx')).toBe(nginxPackageTemplate);
  });

  it('returns undefined for "system" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('system')).toBeUndefined();
  });

  it('resolves "system" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('system', '2.22.1')).toBe(systemPackageTemplate);
    expect(resolveIntegrationTemplate('system', '2.3.2')).toBe(systemPackageTemplate_2_3_2);
  });

  it('resolves by name and version when the version matches the registered template', () => {
    expect(resolveIntegrationTemplate('nginx', nginxPackageTemplate.version)).toBe(nginxPackageTemplate);
  });

  it('returns undefined for an unknown package name, rather than falling back to some other template', () => {
    expect(resolveIntegrationTemplate('does-not-exist')).toBeUndefined();
  });

  it('returns undefined when a known package is at a version with no matching template', () => {
    expect(resolveIntegrationTemplate('nginx', '999.0.0')).toBeUndefined();
    expect(resolveIntegrationTemplate('system', '999.0.0')).toBeUndefined();
  });
});
