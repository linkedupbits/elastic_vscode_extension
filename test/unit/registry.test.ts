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
  it('resolves "system" and "nginx" to their respective templates', () => {
    expect(resolveIntegrationTemplate('system')).toBe(systemPackageTemplate);
    expect(resolveIntegrationTemplate('nginx')).toBe(nginxPackageTemplate);
  });

  it('falls back to a registered template for an unknown package name, rather than throwing', () => {
    const fallback = resolveIntegrationTemplate('does-not-exist');
    expect(Object.values(integrationPackageTemplates)).toContain(fallback);
  });
});
