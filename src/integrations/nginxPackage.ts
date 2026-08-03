import { PackageTemplate } from './packageTemplate';

/**
 * Structural template for the Elastic `nginx` integration package (package version 3.2.1),
 * derived from the package source of truth on GitHub:
 * https://github.com/elastic/integrations/tree/main/packages/nginx
 *   - manifest.yml (policy_templates: input types + input-level vars)
 *   - data_stream/access/manifest.yml, data_stream/error/manifest.yml (logfile streams)
 *   - data_stream/stubstatus/manifest.yml (nginx/metrics stream)
 * Drives both the default values used when creating a new Nginx integration policy, and
 * the structured editor form.
 */
export const nginxPackageTemplate: PackageTemplate = {
  name: 'nginx',
  title: 'Nginx',
  version: '3.2.1',
  inputs: [
    {
      id: 'nginx-logfile',
      label: 'Log File (access / error)',
      defaultEnabled: true,
      vars: [
        { key: 'condition', label: 'Condition', type: 'string', default: '' },
      ],
      streams: [
        {
          id: 'nginx.access',
          label: 'Access',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/nginx/access.log*'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['nginx-access'], required: true },
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'ignore_older', label: 'Ignore Events Older Than', type: 'string', default: '72h' },
          ],
        },
        {
          id: 'nginx.error',
          label: 'Error',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/nginx/error.log*'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['nginx-error'], required: true },
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'ignore_older', label: 'Ignore Events Older Than', type: 'string', default: '72h' },
          ],
        },
      ],
    },
    {
      id: 'nginx-nginx/metrics',
      label: 'Metrics (Stub Status)',
      defaultEnabled: true,
      vars: [
        {
          key: 'hosts',
          label: 'Hosts',
          type: 'stringArray',
          default: ['http://127.0.0.1:80'],
          required: true,
        },
        { key: 'condition', label: 'Condition', type: 'string', default: '' },
      ],
      streams: [
        {
          id: 'nginx.stubstatus',
          label: 'Stub Status',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'server_status_path',
              label: 'Server Status Path',
              type: 'string',
              default: '/nginx_status',
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['nginx-stubstatus'] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
