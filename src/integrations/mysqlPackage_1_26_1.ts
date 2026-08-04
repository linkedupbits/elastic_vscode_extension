import { PackageTemplate } from './packageTemplate';

const SSL_DEFAULT = `#certificate_authorities:
#  - |
#    -----BEGIN CERTIFICATE-----
#    MIIDCjCCAfKgAwIBAgITJ706Mu2wJlKckpIvkWxEHvEyijANBgkqhkiG9w0BAQsF
#    ADAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwIBcNMTkwNzIyMTkyOTA0WhgPMjExOTA2
#    MjgxOTI5MDRaMBQxEjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEB
#    BQADggEPADCCAQoCggEBANce58Y/JykI58iyOXpxGfw0/gMvF0hUQAcUrSMxEO6n
#    fZRA49b4OV4SwWmA3395uL2eB2NB8y8qdQ9muXUdPBWE4l9rMZ6gmfu90N5B5uEl
#    94NcfBfYOKi1fJQ9i7WKhTjlRkMCgBkWPkUokvBZFRt8RtF7zI77BSEorHGQCk9t
#    /D7BS0GJyfVEhftbWcFEAG3VRcoMhF7kUzYwp+qESoriFRYLeDWv68ZOvG7eoWnP
#    PsvZStEVEimjvK5NSESEQa9xWyJOmlOKXhkdymtcUd/nXnx6UTCFgnkgzSdTWV41
#    CI6B6aJ9svCTI2QuoIq2HxX/ix7OvW1huVmcyHVxyUECAwEAAaNTMFEwHQYDVR0O
#    BBYEFPwN1OceFGm9v6ux8G+DZ3TUDYxqMB8GA1UdIwQYMBaAFPwN1OceFGm9v6ux
#    8G+DZ3TUDYxqMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAG5D
#    874A4YI7YUwOVsVAdbWtgp1d0zKcPRR+r2OdSbTAV5/gcS3jgBJ3i1BN34JuDVFw
#    3DeJSYT3nxy2Y56lLnxDeF8CUTUtVQx3CuGkRg1ouGAHpO/6OqOhwLLorEmxi7tA
#    H2O8mtT0poX5AnOAhzVy7QW0D/k4WaoLyckM5hUa6RtvgvLxOwA0U+VGurCDoctu
#    8F4QOgTAWyh8EZIwaKCliFRSynDpv3JTUwtfZkxo6K6nce1RhCWFAsMvDZL8Dgc0
#    yvgJ38BRsFOtkRuAGSf6ZUwTO8JJRRIFnpUzXflAnGivK9M13D5GEQMmIl6U9Pvk
#    sxSmbIUfc2SGJGCJD4I=
#    -----END CERTIFICATE-----
`;

/**
 * Structural template for the Elastic `mysql` integration package (package version 1.26.1),
 * derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/mysql/mysql-1.26.1.zip
 *   - manifest.yml (policy_templates: input types + input-level vars for mysql/metrics and sql/metrics)
 *   - data_stream/error/manifest.yml, data_stream/slowlog/manifest.yml (logfile streams)
 *   - data_stream/status/manifest.yml, data_stream/performance/manifest.yml,
 *     data_stream/galera_status/manifest.yml (mysql/metrics streams)
 *   - data_stream/replica_status/manifest.yml (sql/metrics stream)
 * `sql/metrics` is a distinct input type from `mysql/metrics` (separate DSN, used for the
 * `SHOW REPLICA STATUS;` query) even though both collect metrics — kept as separate InputDefs
 * to mirror the manifest exactly. The `ssl` var's default is an identical commented-out YAML
 * example on both metrics inputs, so it's factored into the shared `SSL_DEFAULT` constant.
 * `galera_status` is the only stream that defaults to disabled (manifest `enabled: false`).
 * No data stream declares `agent.privileges.root: true`, so `requiresRoot` is unset everywhere
 * and a new MySQL policy always computes `requires_root=false`.
 */
export const mysqlPackageTemplate_1_26_1: PackageTemplate = {
  name: 'mysql',
  title: 'MySQL',
  version: '1.26.1',
  inputs: [
    {
      id: 'mysql-logfile',
      label: 'Log File (error / slowlog)',
      defaultEnabled: true,
      streams: [
        {
          id: 'mysql.error',
          label: 'Error',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Error Log Paths',
              type: 'stringArray',
              default: ['/var/log/mysql/error.log*', '/var/log/mysqld.log*'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['mysql-error'], required: true },
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
          id: 'mysql.slowlog',
          label: 'Slowlog',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Slowlog Paths',
              type: 'stringArray',
              default: ['/var/log/mysql/*-slow.log*', '/var/lib/mysql/*-slow.log*'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['mysql-slowlog'], required: true },
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
      id: 'mysql-mysql/metrics',
      label: 'Metrics (Status / Performance / Galera Status)',
      defaultEnabled: true,
      vars: [
        {
          key: 'hosts',
          label: 'MySQL DSN',
          type: 'stringArray',
          default: ['tcp(127.0.0.1:3306)/'],
          required: true,
        },
        { key: 'username', label: 'Username', type: 'string', default: 'root' },
        { key: 'password', label: 'Password', type: 'string', default: 'test' },
        { key: 'ssl', label: 'SSL Configuration', type: 'multiline', default: SSL_DEFAULT },
      ],
      streams: [
        {
          id: 'mysql.status',
          label: 'Status',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'raw', label: 'Raw', type: 'boolean', default: false, required: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'mysql.performance',
          label: 'Performance',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'raw', label: 'Raw', type: 'boolean', default: false, required: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'mysql.galera_status',
          label: 'Galera Status',
          defaultEnabled: false,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'raw', label: 'Raw', type: 'boolean', default: false },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
    {
      id: 'mysql-sql/metrics',
      label: 'Replica Status Metrics',
      defaultEnabled: true,
      vars: [
        {
          key: 'hosts',
          label: 'MySQL DSN',
          type: 'stringArray',
          default: ['username:password@tcp(localhost:3306)/'],
          required: true,
        },
        {
          key: 'replication_status_query',
          label: 'Replica Status Query',
          type: 'string',
          default: 'SHOW REPLICA STATUS;',
          required: true,
        },
        { key: 'ssl', label: 'SSL Configuration', type: 'multiline', default: SSL_DEFAULT },
      ],
      streams: [
        {
          id: 'mysql.replica_status',
          label: 'Replica Status',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10m', required: true },
            {
              key: 'tags',
              label: 'Tags',
              type: 'stringArray',
              default: ['mysql-replica_status'],
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
