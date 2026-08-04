import {
  getIntegrationTemplateChoices,
  integrationPackageTemplates,
  resolveIntegrationTemplate,
} from '../../src/integrations/registry';
import { nginxPackageTemplate } from '../../src/integrations/nginxPackage';
import { systemPackageTemplate } from '../../src/integrations/systemPackage';

describe('getIntegrationTemplateChoices', () => {
  it('lists every registered template with id/label/version', () => {
    const choices = getIntegrationTemplateChoices();
    expect(choices).toEqual(
      expect.arrayContaining([
        { id: 'system', label: 'System', description: 'v2.22.1' },
        { id: 'nginx', label: 'Nginx', description: 'v3.2.1' },
      ])
    );
    expect(choices).toHaveLength(Object.keys(integrationPackageTemplates).length);
  });
});

describe('resolveIntegrationTemplate', () => {
  it('resolves "system" and "nginx" to their respective templates by name', () => {
    expect(resolveIntegrationTemplate('system')).toBe(systemPackageTemplate);
    expect(resolveIntegrationTemplate('nginx')).toBe(nginxPackageTemplate);
  });

  it('resolves by name and version when the version matches the registered template', () => {
    expect(resolveIntegrationTemplate('nginx', nginxPackageTemplate.version)).toBe(nginxPackageTemplate);
  });

  it('returns undefined for an unknown package name, rather than falling back to some other template', () => {
    expect(resolveIntegrationTemplate('does-not-exist')).toBeUndefined();
  });

  it('returns undefined when a known package is at a version with no matching template', () => {
    expect(resolveIntegrationTemplate('nginx', '999.0.0')).toBeUndefined();
  });
});
