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

/**
 * Resolves the structured-editor template for a package. When `packageVersion` is given,
 * the match must be exact (name and version) — a known package at an unimplemented version
 * returns `undefined` just like an unknown package name, so the caller can fall back to a
 * plain JSON editor rather than rendering a structured form that doesn't match the schema.
 * Omit `packageVersion` to match by name only (used when the caller is choosing a template
 * to create a brand-new policy from, where the version is always the template's own).
 */
export function resolveIntegrationTemplate(
  packageName: string,
  packageVersion?: string
): PackageTemplate | undefined {
  const template = integrationPackageTemplates[packageName];
  if (!template) {
    return undefined;
  }
  if (packageVersion !== undefined && packageVersion !== template.version) {
    return undefined;
  }
  return template;
}
