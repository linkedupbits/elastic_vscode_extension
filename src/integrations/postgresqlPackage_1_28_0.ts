import { PackageTemplate } from './packageTemplate';

/**
 * Structural template for the Elastic `postgresql` integration package (package version
 * 1.28.0), derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/postgresql/postgresql-1.28.0.zip
 *   - manifest.yml (policy_templates: input types + input-level vars)
 *   - data_stream/log/manifest.yml (logfile stream)
 *   - data_stream/activity/manifest.yml, data_stream/bgwriter/manifest.yml,
 *     data_stream/database/manifest.yml, data_stream/statement/manifest.yml (all attach to the
 *     postgresql/metrics input)
 * No data stream in this package declares `agent.privileges.root: true`, and none set
 * `enabled: false`, so every stream here defaults to enabled with `requiresRoot` omitted.
 * `username`/`password` have no `required:` key in the manifest (auth is optional, e.g. when
 * relying on peer/trust auth), so they're left non-required here.
 */
export const postgresqlPackageTemplate_1_28_0: PackageTemplate = {
  name: 'postgresql',
  title: 'PostgreSQL',
  version: '1.28.0',
  inputs: [
    {
      id: 'postgresql-logfile',
      label: 'Log File',
      defaultEnabled: true,
      vars: [{ key: 'condition', label: 'Condition', type: 'string', default: '' }],
      streams: [
        {
          id: 'postgresql.log',
          label: 'Log',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/postgresql/postgresql-*-*.log*', '/var/log/postgresql/postgresql-*-*.csv*'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['postgresql-log'], required: true },
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
      id: 'postgresql-postgresql/metrics',
      label: 'Metrics',
      defaultEnabled: true,
      vars: [
        {
          key: 'hosts',
          label: 'Hosts',
          type: 'stringArray',
          default: ['postgres://localhost:5432'],
          required: true,
        },
        { key: 'username', label: 'Username', type: 'string', default: '' },
        { key: 'password', label: 'Password', type: 'string', default: '' },
        { key: 'condition', label: 'Condition', type: 'string', default: '' },
      ],
      streams: [
        {
          id: 'postgresql.activity',
          label: 'Activity',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'postgresql.bgwriter',
          label: 'Background Writer',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'postgresql.database',
          label: 'Database',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'postgresql.statement',
          label: 'Statement',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
