import { PackageTemplate } from './packageTemplate';

/**
 * Structural template for the Elastic `apm` integration package.
 *
 * IMPORTANT PROVENANCE NOTE: version `9.0.3` was never published to the Elastic Package
 * Registry. `curl https://epr.elastic.co/epr/apm/apm-9.0.3.zip` returns 404 ("artifact not
 * found"), and `https://epr.elastic.co/search?package=apm&all=true&prerelease=true` (cross-
 * checked against https://raw.githubusercontent.com/elastic/integrations/main/packages/apm/changelog.yml)
 * shows the real version sequence jumps 8.13.1-preview-1708411360 -> 8.15.0-preview-1716438434
 * -> 8.19.0-preview-1748425740 -> 9.0.0-preview-1738343125 -> 9.1.0-preview-... -> 9.3.x-preview-...
 * with no 9.0.1/9.0.2/9.0.3 ever released. All field content below is therefore sourced from
 * the nearest real EPR build on the 9.0.x line, `apm-9.0.0-preview-1738343125`:
 * https://epr.elastic.co/epr/apm/apm-9.0.0-preview-1738343125.zip (manifest.yml). The
 * `version` field is kept as `9.0.3` to match the package identity this template was
 * requested under.
 *
 * SHAPE NOTE: APM does not look like nginx/system. It ships a single policy-template input
 * of type `apm` (id below is `apm-apm`, per the `apm-<manifestInputType>` naming rule) that
 * carries ~40 server-config vars directly (host/url, secret_token/api_key auth, RUM, TLS,
 * tail-based sampling, timeouts, etc.) via `template_path: template.yml.hbs`. Per the apm
 * package's own changelog, data streams were removed from the package entirely at version
 * 8.15.0-preview-1716438434 ("Remove data streams from integration package") — apm-server
 * now manages its output data streams (traces-apm.*, metrics-apm.*, logs-apm.error)
 * internally rather than declaring them via Fleet `data_stream/<id>/manifest.yml` files, so
 * there is no data_stream directory in the 9.0.0-preview build (or any 9.x build) to read
 * streams from. Our `PackageTemplate` type requires every `InputDef` to carry at least one
 * `StreamDef` (`assertTemplateIsWellFormed`), so a single placeholder stream (`apm.server`)
 * with empty `vars: []` is included purely to satisfy that shape contract — it corresponds
 * to no real data_stream manifest, and all actual configuration lives in the input's own
 * `vars`. No var in the manifest declares `required: true`, and there is no
 * `agent.privileges.root` anywhere in the manifest, so nothing here requires root.
 */
export const apmPackageTemplate_9_0_3: PackageTemplate = {
  name: 'apm',
  title: 'Elastic APM',
  version: '9.0.3',
  inputs: [
    {
      id: 'apm-apm',
      label: 'APM Server',
      defaultEnabled: true,
      vars: [
        { key: 'host', label: 'Host', type: 'string', default: 'localhost:8200' },
        { key: 'url', label: 'URL', type: 'string', default: 'http://localhost:8200' },
        { key: 'secret_token', label: 'Secret Token', type: 'string', default: '' },
        { key: 'api_key_enabled', label: 'API Key Enabled', type: 'boolean', default: false },
        { key: 'enable_rum', label: 'Enable RUM', type: 'boolean', default: true },
        { key: 'anonymous_enabled', label: 'Anonymous Enabled', type: 'boolean', default: true },
        {
          key: 'anonymous_allow_agent',
          label: 'Anonymous Allow Agent',
          type: 'stringArray',
          default: ['rum-js', 'js-base', 'iOS/swift'],
        },
        { key: 'anonymous_allow_service', label: 'Anonymous Allow Service', type: 'stringArray', default: [] },
        {
          key: 'anonymous_rate_limit_event_limit',
          label: 'Anonymous Rate Limit Event Limit',
          type: 'number',
          default: 300,
        },
        {
          key: 'anonymous_rate_limit_ip_limit',
          label: 'Anonymous Rate Limit IP Limit',
          type: 'number',
          default: 1000,
        },
        { key: 'default_service_environment', label: 'Default Service Environment', type: 'string', default: '' },
        { key: 'rum_allow_origins', label: 'RUM Allow Origins', type: 'stringArray', default: ['"*"'] },
        { key: 'rum_allow_headers', label: 'RUM Allow Headers', type: 'stringArray', default: [] },
        { key: 'rum_response_headers', label: 'RUM Response Headers', type: 'multiline', default: '' },
        {
          key: 'rum_library_pattern',
          label: 'RUM Library Pattern',
          type: 'string',
          default: '"node_modules|bower_components|~"',
        },
        {
          key: 'rum_exclude_from_grouping',
          label: 'RUM Exclude From Grouping',
          type: 'string',
          default: '"^/webpack"',
        },
        { key: 'api_key_limit', label: 'API Key Limit', type: 'number', default: 100 },
        { key: 'max_event_bytes', label: 'Max Event Bytes', type: 'number', default: 307200 },
        { key: 'capture_personal_data', label: 'Capture Personal Data', type: 'boolean', default: true },
        { key: 'max_header_bytes', label: 'Max Header Bytes', type: 'number', default: 1048576 },
        { key: 'idle_timeout', label: 'Idle Timeout', type: 'string', default: '45s' },
        { key: 'read_timeout', label: 'Read Timeout', type: 'string', default: '3600s' },
        { key: 'shutdown_timeout', label: 'Shutdown Timeout', type: 'string', default: '30s' },
        { key: 'write_timeout', label: 'Write Timeout', type: 'string', default: '30s' },
        { key: 'max_connections', label: 'Max Connections', type: 'number', default: 0 },
        { key: 'response_headers', label: 'Response Headers', type: 'multiline', default: '' },
        { key: 'expvar_enabled', label: 'Expvar Enabled', type: 'boolean', default: false },
        { key: 'pprof_enabled', label: 'PProf Enabled', type: 'boolean', default: false },
        {
          key: 'java_attacher_discovery_rules',
          label: 'Java Attacher Discovery Rules',
          type: 'multiline',
          default: '',
        },
        { key: 'java_attacher_agent_version', label: 'Java Attacher Agent Version', type: 'string', default: '' },
        { key: 'java_attacher_enabled', label: 'Java Attacher Enabled', type: 'boolean', default: false },
        { key: 'tls_enabled', label: 'TLS Enabled', type: 'boolean', default: false },
        { key: 'tls_certificate', label: 'TLS Certificate', type: 'string', default: '' },
        { key: 'tls_key', label: 'TLS Key', type: 'string', default: '' },
        {
          key: 'tls_supported_protocols',
          label: 'TLS Supported Protocols',
          type: 'stringArray',
          default: ['TLSv1.2', 'TLSv1.3'],
        },
        { key: 'tls_cipher_suites', label: 'TLS Cipher Suites', type: 'stringArray', default: [] },
        { key: 'tls_curve_types', label: 'TLS Curve Types', type: 'stringArray', default: [] },
        {
          // manifest type is `yaml` + `multi: true`, which has no direct analog in our VarType
          // union; the manifest's own default is already a single YAML block listing entries
          // (`- sample_rate: 0.1\n`), so `multiline` is the closest fit.
          key: 'tail_sampling_policies',
          label: 'Tail Sampling Policies',
          type: 'multiline',
          default: '- sample_rate: 0.1\n',
        },
        { key: 'tail_sampling_interval', label: 'Tail Sampling Interval', type: 'string', default: '1m' },
        { key: 'tail_sampling_enabled', label: 'Tail Sampling Enabled', type: 'boolean', default: false },
        { key: 'tail_sampling_storage_limit', label: 'Tail Sampling Storage Limit', type: 'string', default: '0GB' },
      ],
      streams: [
        {
          // No real data_stream manifest backs this id — see the file header note. Present
          // only to satisfy assertTemplateIsWellFormed's "every input needs >=1 stream" rule.
          id: 'apm.server',
          label: 'Server',
          defaultEnabled: true,
          vars: [],
        },
      ],
    },
  ],
};
