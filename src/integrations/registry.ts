import { nginxPackageTemplate } from './nginxPackage';
import { PackageTemplate } from './packageTemplate';
import { systemPackageTemplate } from './systemPackage';
import { systemPackageTemplate_2_3_2 } from './systemPackage_2_3_2';

/**
 * Keyed by `package.name` as it appears in the integration policy JSON. A package name may
 * have more than one entry when a structured editor has been implemented for more than one
 * package version (e.g. `system` at both its current 2.22.1 and the older 2.3.2) — every
 * consumer must resolve a specific `PackageTemplate` via `resolveIntegrationTemplate`, never
 * read this map directly by name.
 */
export const integrationPackageTemplates: Record<string, PackageTemplate[]> = {
  system: [systemPackageTemplate, systemPackageTemplate_2_3_2],
  nginx: [nginxPackageTemplate],
};

/** One choice per registered (name, version) pair, so packages with multiple structured-editor
 * versions show up as separate entries (e.g. "System" v2.22.1 and "System" v2.3.2). */
export function getIntegrationTemplateChoices(): {
  id: string;
  label: string;
  description: string;
  version: string;
}[] {
  return Object.values(integrationPackageTemplates)
    .flat()
    .map((t) => ({
      id: t.name,
      label: t.title,
      description: `v${t.version}`,
      version: t.version,
    }));
}

/**
 * Resolves the structured-editor template for a package. When `packageVersion` is given,
 * the match must be exact (name and version) — a known package at an unimplemented version
 * returns `undefined` just like an unknown package name, so the caller can fall back to a
 * plain JSON editor rather than rendering a structured form that doesn't match the schema.
 * Omitting `packageVersion` matches by name only, and only succeeds when exactly one template
 * is registered for that name — with multiple versions registered, the caller must supply
 * `packageVersion` (e.g. from the version-specific entry `getIntegrationTemplateChoices()`
 * returned) since there is no default/"latest" among them.
 */
export function resolveIntegrationTemplate(
  packageName: string,
  packageVersion?: string
): PackageTemplate | undefined {
  const templates = integrationPackageTemplates[packageName];
  if (!templates) {
    return undefined;
  }
  if (packageVersion !== undefined) {
    return templates.find((t) => t.version === packageVersion);
  }
  return templates.length === 1 ? templates[0] : undefined;
}
