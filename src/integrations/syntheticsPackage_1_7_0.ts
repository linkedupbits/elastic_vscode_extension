import { PackageTemplate } from './packageTemplate';

const FLEET_MANAGED_LOCATION_NAME = {
  key: 'location_name',
  label: 'Location Name',
  type: 'string' as const,
  default: 'Fleet managed',
};
const FLEET_MANAGED_LOCATION_ID = {
  key: 'location_id',
  label: 'Location Id',
  type: 'string' as const,
  default: 'fleet_managed',
};

/**
 * Structural template for the Elastic `synthetics` integration package (package version
 * 1.7.0), derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/synthetics/synthetics-1.7.0.zip
 *   - manifest.yml (policy_templates: input types, none of which declare input-level vars)
 *   - data_stream/http/manifest.yml, data_stream/tcp/manifest.yml, data_stream/icmp/manifest.yml
 *     (one stream each, matching the input of the same name)
 *   - data_stream/browser/manifest.yml, data_stream/browser_network/manifest.yml,
 *     data_stream/browser_screenshot/manifest.yml (all three attach to the synthetics/browser
 *     input - browser carries the monitor config vars, the other two carry no vars at all)
 * SHAPE NOTE: each of the four inputs models one Synthetics monitor type (HTTP/TCP/ICMP/
 * Browser); its single "config" stream's ~20-40 vars are the monitor's own configuration
 * (schedule, target, auth, SSL, retry/maintenance-window behaviour, etc.), not a fixed
 * dataset like other packages' streams. Every config stream sets `enabled: false` in its
 * manifest (Synthetics monitors are opt-in per policy), so every stream here defaults to
 * disabled; the owning inputs themselves default enabled, consistent with every other
 * package in this project. No stream declares `agent.privileges.root`, so nothing here
 * requires root. `password` (manifest `type: password`) maps to `string` per this project's
 * usual convention. Two vars keep the manifest's own apparent copy-paste label mistakes
 * verbatim rather than "fixing" them, per this project's transcribe-don't-guess sourcing
 * rule: `max_redirects` (an integer) is titled "Timeout" in the http stream, and
 * `response.include_body` is titled "Index response headers" (duplicating
 * `response.include_headers`'s own title) in the same stream; `tcp`'s
 * `proxy_use_local_resolver` is likewise titled "Proxy URL", duplicating `proxy_url`'s own
 * title. One label is shortened rather than transcribed verbatim: the browser stream's
 * `throttling.config` manifest `title:` is itself a full sentence ("Either disables
 * throttling or contains the concatenated and ready-to-use throttling configuration
 * parameter, including download, upload, and latency values.") rather than a short label, so
 * it's rendered here as "Throttling Configuration", consistent with how input labels
 * elsewhere in this project (e.g. Apache's "Metrics (Server Status)") are a concise gloss
 * rather than the manifest's own longer description text.
 */
export const syntheticsPackageTemplate_1_7_0: PackageTemplate = {
  name: 'synthetics',
  title: 'Elastic Synthetics',
  version: '1.7.0',
  inputs: [
    {
      id: 'synthetics-synthetics/http',
      label: 'HTTP',
      defaultEnabled: true,
      streams: [
        {
          id: 'synthetics.http',
          label: 'HTTP',
          defaultEnabled: false,
          vars: [
            { key: '__ui', label: 'Metadata About The Package', type: 'multiline', default: '' },
            {
              key: 'enabled',
              label: 'Whether The Monitor Is Enabled',
              type: 'boolean',
              default: true,
              required: true,
            },
            { key: 'type', label: 'Monitor Type', type: 'string', default: 'http', required: true },
            { key: 'name', label: 'Monitor Name', type: 'string', default: '' },
            { key: 'schedule', label: 'Schedule', type: 'string', default: '"@every 3m"', required: true },
            { key: 'urls', label: 'URL', type: 'string', default: '', required: true },
            { key: 'service.name', label: 'APM Service Name', type: 'string', default: '' },
            { key: 'timeout', label: 'Timeout', type: 'string', default: '' },
            { key: 'max_redirects', label: 'Timeout', type: 'number', default: 0 },
            { key: 'proxy_url', label: 'Proxy URL', type: 'string', default: '' },
            { key: 'proxy_headers', label: 'Proxy Headers', type: 'multiline', default: '' },
            { key: 'tags', label: 'Tags', type: 'multiline', default: '' },
            { key: 'username', label: 'Username', type: 'string', default: '' },
            { key: 'password', label: 'Password', type: 'string', default: '' },
            { key: 'response.include_headers', label: 'Index Response Headers', type: 'boolean', default: false },
            { key: 'response.include_body', label: 'Index Response Headers', type: 'string', default: '' },
            {
              key: 'response.include_body_max_bytes',
              label: 'Max Bytes To Include In Response Body When Indexed',
              type: 'string',
              default: '',
            },
            { key: 'check.request.method', label: 'Request Method', type: 'string', default: '' },
            { key: 'check.request.headers', label: 'Optional Request Headers', type: 'multiline', default: '' },
            { key: 'check.request.body', label: 'Optional Request Body', type: 'multiline', default: '' },
            { key: 'check.response.status', label: 'Response Status Includes', type: 'multiline', default: '' },
            { key: 'check.response.headers', label: 'Response Headers Includes', type: 'multiline', default: '' },
            {
              key: 'check.response.body.positive',
              label: 'Check Response Body Includes',
              type: 'multiline',
              default: '',
            },
            {
              key: 'check.response.body.negative',
              label: 'Check Response Body Does Not Include',
              type: 'multiline',
              default: '',
            },
            {
              key: 'check.response.json',
              label: 'A List Of Expressions Executed Against The Body When Parsed As JSON',
              type: 'multiline',
              default: '',
            },
            {
              key: 'ssl.certificate_authorities',
              label: 'SSL Certificate Authorities',
              type: 'multiline',
              default: '',
            },
            { key: 'ssl.certificate', label: 'SSL Certificate', type: 'multiline', default: '' },
            { key: 'ssl.key', label: 'SSL Certificate Private Key', type: 'multiline', default: '' },
            { key: 'ssl.key_passphrase', label: 'SSL Private Key Passphrase', type: 'string', default: '' },
            { key: 'ssl.verification_mode', label: 'SSL Verification Mode', type: 'string', default: '' },
            { key: 'ssl.supported_protocols', label: 'SSL Supported Protocols', type: 'multiline', default: '' },
            FLEET_MANAGED_LOCATION_NAME,
            FLEET_MANAGED_LOCATION_ID,
            { key: 'id', label: 'Id', type: 'string', default: '' },
            { key: 'origin', label: 'Origin Of The Monitor, UI Or Project', type: 'string', default: '' },
            { key: 'mode', label: 'Heartbeat Mode', type: 'string', default: '' },
            { key: 'ipv4', label: 'Use The IPv4 Protocol', type: 'boolean', default: true },
            { key: 'ipv6', label: 'Use The IPv6 Protocol', type: 'boolean', default: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'max_attempts', label: 'Max Attempts', type: 'number', default: 2 },
            { key: 'maintenance_windows', label: 'Maintenance Windows', type: 'multiline', default: '' },
          ],
        },
      ],
    },
    {
      id: 'synthetics-synthetics/tcp',
      label: 'TCP',
      defaultEnabled: true,
      streams: [
        {
          id: 'synthetics.tcp',
          label: 'TCP',
          defaultEnabled: false,
          vars: [
            { key: '__ui', label: 'Metadata About The Package', type: 'multiline', default: '' },
            {
              key: 'enabled',
              label: 'Whether The Monitor Is Enabled',
              type: 'boolean',
              default: true,
              required: true,
            },
            { key: 'type', label: 'Monitor Type', type: 'string', default: 'tcp', required: true },
            { key: 'name', label: 'Monitor Name', type: 'string', default: '' },
            { key: 'schedule', label: 'Schedule', type: 'string', default: '"@every 3m"', required: true },
            { key: 'hosts', label: 'Host', type: 'string', default: '', required: true },
            { key: 'service.name', label: 'APM Service Name', type: 'string', default: '' },
            { key: 'timeout', label: 'Timeout', type: 'string', default: '' },
            { key: 'proxy_url', label: 'Proxy URL', type: 'string', default: '' },
            { key: 'proxy_use_local_resolver', label: 'Proxy URL', type: 'boolean', default: false },
            { key: 'tags', label: 'Tags', type: 'multiline', default: '' },
            { key: 'check.send', label: 'Request Payload', type: 'string', default: '' },
            { key: 'check.receive', label: 'Response Includes', type: 'string', default: '' },
            {
              key: 'ssl.certificate_authorities',
              label: 'SSL Certificate Authorities',
              type: 'multiline',
              default: '',
            },
            { key: 'ssl.certificate', label: 'SSL Certificate', type: 'multiline', default: '' },
            { key: 'ssl.key', label: 'Certificate Private Key', type: 'multiline', default: '' },
            { key: 'ssl.key_passphrase', label: 'SSL Private Key Passphrase', type: 'string', default: '' },
            { key: 'ssl.verification_mode', label: 'SSL Verification Mode', type: 'string', default: '' },
            { key: 'ssl.supported_protocols', label: 'Supported Protocols', type: 'multiline', default: '' },
            FLEET_MANAGED_LOCATION_NAME,
            FLEET_MANAGED_LOCATION_ID,
            { key: 'id', label: 'Id', type: 'string', default: '' },
            { key: 'origin', label: 'Origin Of The Monitor, UI Or Project', type: 'string', default: '' },
            { key: 'mode', label: 'Heartbeat Mode', type: 'string', default: '' },
            { key: 'ipv4', label: 'Use The IPv4 Protocol', type: 'boolean', default: true },
            { key: 'ipv6', label: 'Use The IPv6 Protocol', type: 'boolean', default: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'max_attempts', label: 'Max Attempts', type: 'number', default: 2 },
            { key: 'maintenance_windows', label: 'Maintenance Windows', type: 'multiline', default: '' },
          ],
        },
      ],
    },
    {
      id: 'synthetics-synthetics/icmp',
      label: 'ICMP',
      defaultEnabled: true,
      streams: [
        {
          id: 'synthetics.icmp',
          label: 'ICMP',
          defaultEnabled: false,
          vars: [
            { key: '__ui', label: 'Metadata About The Package', type: 'multiline', default: '' },
            {
              key: 'enabled',
              label: 'Whether The Monitor Is Enabled',
              type: 'boolean',
              default: true,
              required: true,
            },
            { key: 'type', label: 'Monitor Type', type: 'string', default: 'icmp', required: true },
            { key: 'name', label: 'Monitor Name', type: 'string', default: '' },
            { key: 'schedule', label: 'Schedule', type: 'string', default: '"@every 3m"', required: true },
            { key: 'wait', label: 'Wait', type: 'string', default: '1s', required: true },
            { key: 'hosts', label: 'Host', type: 'string', default: '', required: true },
            { key: 'service.name', label: 'APM Service Name', type: 'string', default: '' },
            { key: 'timeout', label: 'Timeout', type: 'string', default: '' },
            { key: 'tags', label: 'Tags', type: 'multiline', default: '' },
            FLEET_MANAGED_LOCATION_NAME,
            FLEET_MANAGED_LOCATION_ID,
            { key: 'id', label: 'Id', type: 'string', default: '' },
            { key: 'origin', label: 'Origin Of The Monitor, UI Or Project', type: 'string', default: '' },
            { key: 'mode', label: 'Heartbeat Mode', type: 'string', default: '' },
            { key: 'ipv4', label: 'Use The IPv4 Protocol', type: 'boolean', default: true },
            { key: 'ipv6', label: 'Use The IPv6 Protocol', type: 'boolean', default: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'max_attempts', label: 'Max Attempts', type: 'number', default: 2 },
            { key: 'maintenance_windows', label: 'Maintenance Windows', type: 'multiline', default: '' },
          ],
        },
      ],
    },
    {
      id: 'synthetics-synthetics/browser',
      label: 'Browser',
      defaultEnabled: true,
      streams: [
        {
          id: 'synthetics.browser',
          label: 'Browser',
          defaultEnabled: false,
          vars: [
            { key: '__ui', label: 'UI Metadata About The Policy', type: 'multiline', default: '' },
            {
              key: 'enabled',
              label: 'Whether The Monitor Is Enabled',
              type: 'boolean',
              default: true,
              required: true,
            },
            { key: 'type', label: 'Monitor Type', type: 'string', default: 'browser', required: true },
            { key: 'name', label: 'Monitor Name', type: 'string', default: '' },
            { key: 'schedule', label: 'Schedule', type: 'string', default: '"@every 3m"', required: true },
            { key: 'service.name', label: 'APM Service Name', type: 'string', default: '' },
            { key: 'timeout', label: 'Timeout', type: 'string', default: '' },
            { key: 'tags', label: 'Tags', type: 'multiline', default: '' },
            { key: 'source.inline.script', label: 'Inline Synthetics Script', type: 'multiline', default: '' },
            { key: 'source.inline.encoding', label: 'Encoding Type For Inline Script', type: 'string', default: '' },
            { key: 'source.project.content', label: 'Project Monitor Script', type: 'string', default: '' },
            { key: 'params', label: 'Synthetics Script Params', type: 'multiline', default: '' },
            { key: 'playwright_options', label: 'Synthetics Playwright Options', type: 'multiline', default: '' },
            { key: 'screenshots', label: 'Synthetics Screenshot Options', type: 'string', default: '' },
            {
              key: 'synthetics_args',
              label: 'Extra Arguments Passed To Synthetic By Heartbeat',
              type: 'string',
              default: '',
            },
            {
              key: 'ignore_https_errors',
              label: 'Adds An Option To Disable Errors On Invalid TLS Certificates In Heartbeat',
              type: 'boolean',
              default: false,
            },
            { key: 'throttling.config', label: 'Throttling Configuration', type: 'string', default: '' },
            {
              key: 'filter_journeys.tags',
              label: 'Run Only Journeys With The Given Tag(s), Or Globs',
              type: 'multiline',
              default: '',
            },
            {
              key: 'filter_journeys.match',
              label: 'Run Only Journeys With A Name Or Tags That Matches The Configured Glob',
              type: 'string',
              default: '',
            },
            FLEET_MANAGED_LOCATION_NAME,
            FLEET_MANAGED_LOCATION_ID,
            { key: 'id', label: 'Id', type: 'string', default: '' },
            { key: 'origin', label: 'Origin Of The Monitor, UI Or Project', type: 'string', default: '' },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'max_attempts', label: 'Max Attempts', type: 'number', default: 2 },
            { key: 'maintenance_windows', label: 'Maintenance Windows', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'synthetics.browser.network',
          label: 'Browser Network',
          defaultEnabled: false,
          vars: [],
        },
        {
          id: 'synthetics.browser.screenshot',
          label: 'Browser Screenshot',
          defaultEnabled: false,
          vars: [],
        },
      ],
    },
  ],
};
