import { PackageTemplate } from './packageTemplate';

const APACHE_METRICS_SSL_DEFAULT =
  '#certificate_authorities:\n' +
  '#  - |\n' +
  '#    -----BEGIN CERTIFICATE-----\n' +
  '#    MIIDCjCCAfKgAwIBAgITJ706Mu2wJlKckpIvkWxEHvEyijANBgkqhkiG9w0BAQsF\n' +
  '#    ADAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwIBcNMTkwNzIyMTkyOTA0WhgPMjExOTA2\n' +
  '#    MjgxOTI5MDRaMBQxEjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEB\n' +
  '#    BQADggEPADCCAQoCggEBANce58Y/JykI58iyOXpxGfw0/gMvF0hUQAcUrSMxEO6n\n' +
  '#    fZRA49b4OV4SwWmA3395uL2eB2NB8y8qdQ9muXUdPBWE4l9rMZ6gmfu90N5B5uEl\n' +
  '#    94NcfBfYOKi1fJQ9i7WKhTjlRkMCgBkWPkUokvBZFRt8RtF7zI77BSEorHGQCk9t\n' +
  '#    /D7BS0GJyfVEhftbWcFEAG3VRcoMhF7kUzYwp+qESoriFRYLeDWv68ZOvG7eoWnP\n' +
  '#    PsvZStEVEimjvK5NSESEQa9xWyJOmlOKXhkdymtcUd/nXnx6UTCFgnkgzSdTWV41\n' +
  '#    CI6B6aJ9svCTI2QuoIq2HxX/ix7OvW1huVmcyHVxyUECAwEAAaNTMFEwHQYDVR0O\n' +
  '#    BBYEFPwN1OceFGm9v6ux8G+DZ3TUDYxqMB8GA1UdIwQYMBaAFPwN1OceFGm9v6ux\n' +
  '#    8G+DZ3TUDYxqMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAG5D\n' +
  '#    874A4YI7YUwOVsVAdbWtgp1d0zKcPRR+r2OdSbTAV5/gcS3jgBJ3i1BN34JuDVFw\n' +
  '#    3DeJSYT3nxy2Y56lLnxDeF8CUTUtVQx3CuGkRg1ouGAHpO/6OqOhwLLorEmxi7tA\n' +
  '#    H2O8mtT0poX5AnOAhzVy7QW0D/k4WaoLyckM5hUa6RtvgvLxOwA0U+VGurCDoctu\n' +
  '#    8F4QOgTAWyh8EZIwaKCliFRSynDpv3JTUwtfZkxo6K6nce1RhCWFAsMvDZL8Dgc0\n' +
  '#    yvgJ38BRsFOtkRuAGSf6ZUwTO8JJRRIFnpUzXflAnGivK9M13D5GEQMmIl6U9Pvk\n' +
  '#    sxSmbIUfc2SGJGCJD4I=\n' +
  '#    -----END CERTIFICATE-----\n';

/**
 * Structural template for the Elastic `apache` integration package at package version 2.1.1,
 * registered alongside `apachePackageTemplate_2_0_0` (2.0.0) so policies pinned to 2.1.1 get a
 * structured editor too. Derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/apache/apache-2.1.1.zip
 *   - manifest.yml (policy_templates: input types + input-level vars)
 *   - data_stream/access/manifest.yml, data_stream/error/manifest.yml (logfile streams)
 *   - data_stream/status/manifest.yml (apache/metrics stream)
 * Verified structurally identical to 2.0.0 (same inputs/streams/vars/defaults/required flags);
 * the only differences in the raw manifests are cosmetic - a trailing whitespace character
 * after 2.0.0's `-----END CERTIFICATE-----` SSL default line that 2.1.1 doesn't have (preserved
 * exactly in `APACHE_METRICS_SSL_DEFAULT` above), and a line-wrapping change in the `status`
 * stream's `processors` var description. No data stream in this manifest declares
 * `agent.privileges.root`, so no stream here sets `requiresRoot` (mirrors 2.0.0 and Nginx).
 */
export const apachePackageTemplate_2_1_1: PackageTemplate = {
  name: 'apache',
  title: 'Apache HTTP Server',
  version: '2.1.1',
  inputs: [
    {
      id: 'apache-logfile',
      label: 'Log File (access / error)',
      defaultEnabled: true,
      vars: [{ key: 'condition', label: 'Condition', type: 'string', default: '' }],
      streams: [
        {
          id: 'apache.access',
          label: 'Access',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: [
                '/var/log/apache2/access.log*',
                '/var/log/apache2/other_vhosts_access.log*',
                '/var/log/httpd/access_log*',
              ],
              required: true,
            },
            { key: 'ignore_older', label: 'Ignore Events Older Than', type: 'string', default: '72h' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['apache-access'], required: true },
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'apache.error',
          label: 'Error',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/apache2/error.log*', '/var/log/httpd/error_log*'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['apache-error'], required: true },
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
    {
      id: 'apache-apache/metrics',
      label: 'Metrics (Server Status)',
      defaultEnabled: true,
      vars: [
        { key: 'hosts', label: 'Hosts', type: 'stringArray', default: ['http://127.0.0.1'], required: true },
        { key: 'condition', label: 'Condition', type: 'string', default: '' },
        { key: 'ssl', label: 'SSL Configuration', type: 'multiline', default: APACHE_METRICS_SSL_DEFAULT },
      ],
      streams: [
        {
          id: 'apache.status',
          label: 'Status',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '30s', required: true },
            {
              key: 'server_status_path',
              label: 'Server Status Path',
              type: 'string',
              default: '/server-status',
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
