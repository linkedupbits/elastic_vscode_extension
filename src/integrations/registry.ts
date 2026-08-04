import { apachePackageTemplate_2_0_0 } from './apachePackage_2_0_0';
import { apachePackageTemplate_2_1_1 } from './apachePackage_2_1_1';
import { apmPackageTemplate_9_0_3 } from './apmPackage_9_0_3';
import { apmPackageTemplate_9_4_3 } from './apmPackage_9_4_3';
import { dockerPackageTemplate_2_15_2 } from './dockerPackage_2_15_2';
import { filestreamPackageTemplate_1_1_5 } from './filestreamPackage_1_1_5';
import { filestreamPackageTemplate_1_1_3 } from './filestreamPackage_1_1_3';
import { logPackageTemplate_2_4_4 } from './logPackage_2_4_4';
import { mysqlPackageTemplate_1_26_1 } from './mysqlPackage_1_26_1';
import { nginxPackageTemplate_3_2_1 } from './nginxPackage_3_2_1';
import { nginxPackageTemplate_2_3_2 } from './nginxPackage_2_3_2';
import { nginxPackageTemplate_2_0_0 } from './nginxPackage_2_0_0';
import { PackageTemplate } from './packageTemplate';
import { phpFpmPackageTemplate_1_6_0 } from './phpFpmPackage_1_6_0';
import { postgresqlPackageTemplate_1_29_0 } from './postgresqlPackage_1_29_0';
import { postgresqlPackageTemplate_1_28_0 } from './postgresqlPackage_1_28_0';
import { prometheusPackageTemplate_1_23_1 } from './prometheusPackage_1_23_1';
import { syntheticsPackageTemplate_1_7_0 } from './syntheticsPackage_1_7_0';
import { systemPackageTemplate_2_22_1 } from './systemPackage_2_22_1';
import { systemPackageTemplate_2_21_0 } from './systemPackage_2_21_0';
import { systemPackageTemplate_2_6_3 } from './systemPackage_2_6_3';
import { systemPackageTemplate_2_3_2 } from './systemPackage_2_3_2';

/**
 * Keyed by `package.name` as it appears in the integration policy JSON. A package name may
 * have more than one entry when a structured editor has been implemented for more than one
 * package version (e.g. `system` at its current 2.22.1, 2.6.3, and the older 2.3.2) — every
 * consumer must resolve a specific `PackageTemplate` via `resolveIntegrationTemplate`, never
 * read this map directly by name.
 */
export const integrationPackageTemplates: Record<string, PackageTemplate[]> = {
  system: [
    systemPackageTemplate_2_22_1,
    systemPackageTemplate_2_21_0,
    systemPackageTemplate_2_6_3,
    systemPackageTemplate_2_3_2,
  ],
  nginx: [nginxPackageTemplate_3_2_1, nginxPackageTemplate_2_3_2, nginxPackageTemplate_2_0_0],
  apache: [apachePackageTemplate_2_1_1, apachePackageTemplate_2_0_0],
  apm: [apmPackageTemplate_9_4_3, apmPackageTemplate_9_0_3],
  mysql: [mysqlPackageTemplate_1_26_1],
  filestream: [filestreamPackageTemplate_1_1_5, filestreamPackageTemplate_1_1_3],
  php_fpm: [phpFpmPackageTemplate_1_6_0],
  prometheus: [prometheusPackageTemplate_1_23_1],
  log: [logPackageTemplate_2_4_4],
  postgresql: [postgresqlPackageTemplate_1_29_0, postgresqlPackageTemplate_1_28_0],
  docker: [dockerPackageTemplate_2_15_2],
  synthetics: [syntheticsPackageTemplate_1_7_0],
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
