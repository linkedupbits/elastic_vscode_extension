import { nginxPackageTemplate } from './nginxPackage';
import { PackageTemplate } from './packageTemplate';
import { systemPackageTemplate } from './systemPackage';

/** Keyed by `package.name` as it appears in the integration policy JSON. */
export const integrationPackageTemplates: Record<string, PackageTemplate> = {
  system: systemPackageTemplate,
  nginx: nginxPackageTemplate,
};

export function getIntegrationTemplateChoices(): { id: string; label: string; description: string }[] {
  return Object.values(integrationPackageTemplates).map((t) => ({
    id: t.name,
    label: t.title,
    description: `v${t.version}`,
  }));
}

export function resolveIntegrationTemplate(packageName: string): PackageTemplate {
  return integrationPackageTemplates[packageName] ?? Object.values(integrationPackageTemplates)[0];
}
