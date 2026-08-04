import { PackageTemplate } from './packageTemplate';

const SSL_CONFIG_DEFAULT =
  "#certificate_authorities:\n#  - |\n#    -----BEGIN CERTIFICATE-----\n#    MIIDCjCCAfKgAwIBAgITJ706Mu2wJlKckpIvkWxEHvEyijANBgkqhkiG9w0BAQsF\n#    ADAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwIBcNMTkwNzIyMTkyOTA0WhgPMjExOTA2\n#    MjgxOTI5MDRaMBQxEjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEB\n#    BQADggEPADCCAQoCggEBANce58Y/JykI58iyOXpxGfw0/gMvF0hUQAcUrSMxEO6n\n#    fZRA49b4OV4SwWmA3395uL2eB2NB8y8qdQ9muXUdPBWE4l9rMZ6gmfu90N5B5uEl\n#    94NcfBfYOKi1fJQ9i7WKhTjlRkMCgBkWPkUokvBZFRt8RtF7zI77BSEorHGQCk9t\n#    /D7BS0GJyfVEhftbWcFEAG3VRcoMhF7kUzYwp+qESoriFRYLeDWv68ZOvG7eoWnP\n#    PsvZStEVEimjvK5NSESEQa9xWyJOmlOKXhkdymtcUd/nXnx6UTCFgnkgzSdTWV41\n#    CI6B6aJ9svCTI2QuoIq2HxX/ix7OvW1huVmcyHVxyUECAwEAAaNTMFEwHQYDVR0O\n#    BBYEFPwN1OceFGm9v6ux8G+DZ3TUDYxqMB8GA1UdIwQYMBaAFPwN1OceFGm9v6ux\n#    8G+DZ3TUDYxqMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAG5D\n#    874A4YI7YUwOVsVAdbWtgp1d0zKcPRR+r2OdSbTAV5/gcS3jgBJ3i1BN34JuDVFw\n#    3DeJSYT3nxy2Y56lLnxDeF8CUTUtVQx3CuGkRg1ouGAHpO/6OqOhwLLorEmxi7tA\n#    H2O8mtT0poX5AnOAhzVy7QW0D/k4WaoLyckM5hUa6RtvgvLxOwA0U+VGurCDoctu\n#    8F4QOgTAWyh8EZIwaKCliFRSynDpv3JTUwtfZkxo6K6nce1RhCWFAsMvDZL8Dgc0\n#    yvgJ38BRsFOtkRuAGSf6ZUwTO8JJRRIFnpUzXflAnGivK9M13D5GEQMmIl6U9Pvk\n#    sxSmbIUfc2SGJGCJD4I=\n#    -----END CERTIFICATE-----\n";

/**
 * Structural template for the Elastic `php_fpm` integration package (package version 1.6.0),
 * derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/php_fpm/php_fpm-1.6.0.zip
 *   - manifest.yml (policy_templates: single `httpjson` input type + input-level vars)
 *   - data_stream/process/manifest.yml, data_stream/pool/manifest.yml (both attach to the
 *     same `httpjson` input)
 * The manifest's `name:` is `php_fpm` (underscore); this file/export use camelCase per our
 * convention, but `package.name` in built policies stays `php_fpm` to match Fleet.
 * No data stream declares `agent.privileges.root`, so no stream sets `requiresRoot`.
 */
export const phpFpmPackageTemplate_1_6_0: PackageTemplate = {
  name: 'php_fpm',
  title: 'PHP-FPM',
  version: '1.6.0',
  inputs: [
    {
      id: 'php_fpm-httpjson',
      label: 'Metrics (Process / Pool)',
      defaultEnabled: true,
      vars: [
        { key: 'hostname', label: 'Hostname', type: 'string', default: 'http://localhost', required: true },
        { key: 'enable_request_tracer', label: 'Enable Request Tracing', type: 'boolean', default: false },
        { key: 'status_path', label: 'Status Path', type: 'string', default: '/status', required: true },
        { key: 'ssl', label: 'SSL Configuration', type: 'multiline', default: SSL_CONFIG_DEFAULT },
      ],
      streams: [
        {
          id: 'php_fpm.process',
          label: 'Process',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'tags',
              label: 'Tags',
              type: 'stringArray',
              default: ['php_fpm-process', 'forwarded'],
              required: true,
            },
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
          id: 'php_fpm.pool',
          label: 'Pool',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'tags',
              label: 'Tags',
              type: 'stringArray',
              default: ['php_fpm-pool', 'forwarded'],
              required: true,
            },
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
  ],
};
