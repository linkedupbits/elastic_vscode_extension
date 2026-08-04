import {
  getIntegrationTemplateChoices,
  integrationPackageTemplates,
  resolveIntegrationTemplate,
} from '../../src/integrations/registry';
import { apachePackageTemplate_2_0_0 } from '../../src/integrations/apachePackage_2_0_0';
import { apachePackageTemplate_2_1_1 } from '../../src/integrations/apachePackage_2_1_1';
import { apmPackageTemplate_9_0_3 } from '../../src/integrations/apmPackage_9_0_3';
import { apmPackageTemplate_9_4_3 } from '../../src/integrations/apmPackage_9_4_3';
import { dockerPackageTemplate_2_15_2 } from '../../src/integrations/dockerPackage_2_15_2';
import { nginxPackageTemplate_3_2_1 } from '../../src/integrations/nginxPackage_3_2_1';
import { nginxPackageTemplate_2_3_2 } from '../../src/integrations/nginxPackage_2_3_2';
import { nginxPackageTemplate_2_0_0 } from '../../src/integrations/nginxPackage_2_0_0';
import { postgresqlPackageTemplate_1_29_0 } from '../../src/integrations/postgresqlPackage_1_29_0';
import { postgresqlPackageTemplate_1_28_0 } from '../../src/integrations/postgresqlPackage_1_28_0';
import { syntheticsPackageTemplate_1_7_0 } from '../../src/integrations/syntheticsPackage_1_7_0';
import { systemPackageTemplate_2_22_1 } from '../../src/integrations/systemPackage_2_22_1';
import { systemPackageTemplate_2_21_0 } from '../../src/integrations/systemPackage_2_21_0';
import { systemPackageTemplate_2_3_2 } from '../../src/integrations/systemPackage_2_3_2';
import { systemPackageTemplate_2_6_3 } from '../../src/integrations/systemPackage_2_6_3';

describe('getIntegrationTemplateChoices', () => {
  it('lists every registered (name, version) template, including multiple versions of the same package', () => {
    const choices = getIntegrationTemplateChoices();
    expect(choices).toEqual(
      expect.arrayContaining([
        { id: 'system', label: 'System', description: 'v2.22.1', version: '2.22.1' },
        { id: 'system', label: 'System', description: 'v2.21.0', version: '2.21.0' },
        { id: 'system', label: 'System', description: 'v2.6.3', version: '2.6.3' },
        { id: 'system', label: 'System', description: 'v2.3.2', version: '2.3.2' },
        { id: 'nginx', label: 'Nginx', description: 'v3.2.1', version: '3.2.1' },
        { id: 'nginx', label: 'Nginx', description: 'v2.3.2', version: '2.3.2' },
        { id: 'nginx', label: 'Nginx', description: 'v2.0.0', version: '2.0.0' },
        { id: 'apache', label: 'Apache HTTP Server', description: 'v2.1.1', version: '2.1.1' },
        { id: 'apache', label: 'Apache HTTP Server', description: 'v2.0.0', version: '2.0.0' },
        { id: 'apm', label: 'Elastic APM', description: 'v9.4.3', version: '9.4.3' },
        { id: 'apm', label: 'Elastic APM', description: 'v9.0.3', version: '9.0.3' },
        { id: 'postgresql', label: 'PostgreSQL', description: 'v1.29.0', version: '1.29.0' },
        { id: 'postgresql', label: 'PostgreSQL', description: 'v1.28.0', version: '1.28.0' },
        { id: 'docker', label: 'Docker', description: 'v2.15.2', version: '2.15.2' },
        { id: 'synthetics', label: 'Elastic Synthetics', description: 'v1.7.0', version: '1.7.0' },
      ])
    );
    const totalTemplates = Object.values(integrationPackageTemplates).reduce((n, ts) => n + ts.length, 0);
    expect(choices).toHaveLength(totalTemplates);
  });
});

describe('resolveIntegrationTemplate', () => {
  it('resolves "docker" by name only, since only one template is registered for it', () => {
    expect(resolveIntegrationTemplate('docker')).toBe(dockerPackageTemplate_2_15_2);
  });

  it('resolves "synthetics" by name only, since only one template is registered for it', () => {
    expect(resolveIntegrationTemplate('synthetics')).toBe(syntheticsPackageTemplate_1_7_0);
  });

  it('returns undefined for "system" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('system')).toBeUndefined();
  });

  it('returns undefined for "nginx" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('nginx')).toBeUndefined();
  });

  it('returns undefined for "apache" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('apache')).toBeUndefined();
  });

  it('returns undefined for "apm" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('apm')).toBeUndefined();
  });

  it('returns undefined for "postgresql" by name only, since multiple versions are registered and none is a default', () => {
    expect(resolveIntegrationTemplate('postgresql')).toBeUndefined();
  });

  it('resolves "system" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('system', '2.22.1')).toBe(systemPackageTemplate_2_22_1);
    expect(resolveIntegrationTemplate('system', '2.21.0')).toBe(systemPackageTemplate_2_21_0);
    expect(resolveIntegrationTemplate('system', '2.6.3')).toBe(systemPackageTemplate_2_6_3);
    expect(resolveIntegrationTemplate('system', '2.3.2')).toBe(systemPackageTemplate_2_3_2);
  });

  it('resolves "nginx" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('nginx', '3.2.1')).toBe(nginxPackageTemplate_3_2_1);
    expect(resolveIntegrationTemplate('nginx', '2.3.2')).toBe(nginxPackageTemplate_2_3_2);
    expect(resolveIntegrationTemplate('nginx', '2.0.0')).toBe(nginxPackageTemplate_2_0_0);
  });

  it('resolves "apache" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('apache', '2.1.1')).toBe(apachePackageTemplate_2_1_1);
    expect(resolveIntegrationTemplate('apache', '2.0.0')).toBe(apachePackageTemplate_2_0_0);
  });

  it('resolves "apm" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('apm', '9.4.3')).toBe(apmPackageTemplate_9_4_3);
    expect(resolveIntegrationTemplate('apm', '9.0.3')).toBe(apmPackageTemplate_9_0_3);
  });

  it('resolves "postgresql" to the matching template when the version is given', () => {
    expect(resolveIntegrationTemplate('postgresql', '1.29.0')).toBe(postgresqlPackageTemplate_1_29_0);
    expect(resolveIntegrationTemplate('postgresql', '1.28.0')).toBe(postgresqlPackageTemplate_1_28_0);
  });

  it('resolves by name and version when the version matches the registered template', () => {
    expect(resolveIntegrationTemplate('docker', dockerPackageTemplate_2_15_2.version)).toBe(
      dockerPackageTemplate_2_15_2
    );
  });

  it('returns undefined for an unknown package name, rather than falling back to some other template', () => {
    expect(resolveIntegrationTemplate('does-not-exist')).toBeUndefined();
  });

  it('returns undefined when a known package is at a version with no matching template', () => {
    expect(resolveIntegrationTemplate('nginx', '999.0.0')).toBeUndefined();
    expect(resolveIntegrationTemplate('system', '999.0.0')).toBeUndefined();
  });
});
