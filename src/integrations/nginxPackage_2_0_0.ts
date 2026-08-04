import { PackageTemplate } from './packageTemplate';

/**
 * Structural template for the Elastic `nginx` integration package at the older package
 * version 2.0.0, registered alongside `nginxPackageTemplate_3_2_1` (3.2.1) so policies still pinned
 * to 2.0.0 get a structured editor too. Derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/nginx/nginx-2.0.0.zip
 *   - manifest.yml (policy_templates: input types + input-level vars)
 *   - data_stream/access/manifest.yml, data_stream/error/manifest.yml (logfile streams)
 *   - data_stream/stubstatus/manifest.yml (nginx/metrics stream)
 * Notable difference from 3.2.1: neither input declares a `condition` var (that OS/env
 * matching var was added in a later release) — otherwise the access/error/stubstatus streams
 * are var-for-var identical, including all defaults and required flags.
 */
export const nginxPackageTemplate_2_0_0: PackageTemplate = {
  name: 'nginx',
  title: 'Nginx',
  version: '2.0.0',
  inputs: [
    {
      id: 'nginx-logfile',
      label: 'Log File (access / error)',
      defaultEnabled: true,
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
