import { PackageTemplate } from './packageTemplate';

/**
 * Structural template for the Elastic `docker` integration package (package version 2.15.2),
 * derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/docker/docker-2.15.2.zip
 *   - manifest.yml (policy_templates: input types + input-level vars)
 *   - data_stream/container/manifest.yml, data_stream/cpu/manifest.yml,
 *     data_stream/diskio/manifest.yml, data_stream/event/manifest.yml,
 *     data_stream/healthcheck/manifest.yml, data_stream/image/manifest.yml,
 *     data_stream/info/manifest.yml, data_stream/memory/manifest.yml,
 *     data_stream/network/manifest.yml (all attach to the docker/metrics input)
 *   - data_stream/container_logs/manifest.yml (attaches to the filestream input)
 * Every `docker/metrics` stream repeats its own `hosts`/`period`/`labels.dedot` vars (the
 * `info` stream is the only one that omits `labels.dedot`) since the manifest itself declares
 * them per-stream rather than at the input level - transcribed as-is rather than deduplicated,
 * matching how this project already models System's per-stream `tags`/`processors` repetition.
 * `image` is the only stream that sets `enabled: false` in its manifest, so it's the only one
 * defaulting to disabled here. No data stream declares `agent.privileges.root`, so no stream
 * sets `requiresRoot`. The `filestream` policy-template input has no top-level `vars:` key at
 * all, so its `InputDef.vars` is omitted (per this project's "undefined means no vars section"
 * convention), while `docker/metrics` carries the single `podman` boolean var.
 */
export const dockerPackageTemplate_2_15_2: PackageTemplate = {
  name: 'docker',
  title: 'Docker',
  version: '2.15.2',
  inputs: [
    {
      id: 'docker-docker/metrics',
      label: 'Docker Metrics',
      defaultEnabled: true,
      vars: [{ key: 'podman', label: 'Podman', type: 'boolean', default: false }],
      streams: [
        {
          id: 'docker.container',
          label: 'Container',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
        {
          id: 'docker.cpu',
          label: 'CPU',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
        {
          id: 'docker.diskio',
          label: 'Disk IO',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'skip_major',
              label: 'Skip Major Device Numbers',
              type: 'stringArray',
              default: ['9', '253'],
            },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
        {
          id: 'docker.event',
          label: 'Event',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
        {
          id: 'docker.healthcheck',
          label: 'Healthcheck',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
        {
          id: 'docker.image',
          label: 'Image',
          defaultEnabled: false,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
        {
          id: 'docker.info',
          label: 'Info',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
          ],
        },
        {
          id: 'docker.memory',
          label: 'Memory',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
        {
          id: 'docker.network',
          label: 'Network',
          defaultEnabled: true,
          vars: [
            {
              key: 'hosts',
              label: 'Hosts',
              type: 'stringArray',
              default: ['unix:///var/run/docker.sock'],
              required: true,
            },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'labels.dedot', label: 'De-Dot Labels', type: 'boolean', default: true },
          ],
        },
      ],
    },
    {
      id: 'docker-filestream',
      label: 'Container Logs',
      defaultEnabled: true,
      streams: [
        {
          id: 'docker.container_logs',
          label: 'Container Logs',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Docker Container Log Path',
              type: 'stringArray',
              default: ['/var/lib/docker/containers/${docker.container.id}/*-json.log'],
              required: true,
            },
            {
              key: 'containerParserStream',
              label: "Container Parser's Stream Configuration",
              type: 'string',
              default: 'all',
              required: true,
            },
            { key: 'condition', label: 'Condition', type: 'string', default: '' },
            {
              key: 'additionalParsersConfig',
              label: 'Additional Parsers Configuration',
              type: 'multiline',
              default:
                "# - ndjson:\n#     target: json\n#     ignore_decoding_error: true\n# - multiline:\n#     type: pattern\n#     pattern: '^\\['\n#     negate: true\n#     match: after\n",
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
