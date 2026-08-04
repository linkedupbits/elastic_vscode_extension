import { PackageTemplate } from './packageTemplate';

const HEADERS_DEFAULT = '# headers:\n#   Cookie: abcdef=123456\n#   My-Custom-Header: my-custom-value\n';
const HTTP_QUERY_DEFAULT = '# query:\n#   key: value\n';
const QUERIES_DEFAULT =
  '- name: instant_vector\n  params:\n    query: sum(rate(prometheus_http_requests_total[2m]))\n  path: /api/v1/query\n- name: range_vector\n  params:\n    end: "2019-12-21T00:00:00.000Z"\n    query: up\n    start: "2019-12-20T00:00:00.000Z"\n    step: 1h\n  path: /api/v1/query_range\n- name: scalar\n  params:\n    query: "100"\n  path: /api/v1/query\n- name: string\n  params:\n    query: some_value\n  path: /api/v1/query\n';

/**
 * Structural template for the Elastic `prometheus` integration package (package version
 * 1.23.1), derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/prometheus/prometheus-1.23.1.zip
 *   - manifest.yml (policy_templates: single `prometheus/metrics` input type, no
 *     input-level vars section at all)
 *   - data_stream/collector/manifest.yml, data_stream/query/manifest.yml,
 *     data_stream/remote_write/manifest.yml (all three attach to the same
 *     `prometheus/metrics` input)
 * `query` and `remote_write` both declare `enabled: false` in their manifests, so those
 * streams default off; `collector` is the only stream enabled by default. No data stream
 * declares `agent.privileges.root`, so no stream sets `requiresRoot`.
 */
export const prometheusPackageTemplate_1_23_1: PackageTemplate = {
  name: 'prometheus',
  title: 'Prometheus',
  version: '1.23.1',
  inputs: [
    {
      id: 'prometheus-prometheus/metrics',
      label: 'Metrics (Collector / Query / Remote Write)',
      defaultEnabled: true,
      streams: [
        {
          id: 'prometheus.collector',
          label: 'Collector',
          defaultEnabled: true,
          vars: [
            { key: 'hosts', label: 'Hosts', type: 'stringArray', default: ['localhost:9090'], required: true },
            { key: 'metrics_path', label: 'Metrics Path', type: 'string', default: '/metrics' },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'use_types', label: 'Use Types', type: 'boolean', default: true, required: true },
            { key: 'rate_counters', label: 'Rate Counters', type: 'boolean', default: true, required: true },
            { key: 'leaderelection', label: 'Leader Election', type: 'boolean', default: false, required: true },
            { key: 'condition', label: 'Condition', type: 'string', default: '' },
            { key: 'bearer_token_file', label: 'Bearer Token File', type: 'string', default: '' },
            { key: 'ssl.verification_mode', label: 'SSL Verification Mode', type: 'string', default: 'none' },
            {
              key: 'ssl.certificate_authorities',
              label: 'SSL Certificate Authorities',
              type: 'stringArray',
              default: [],
            },
            { key: 'ssl.certificate', label: 'SSL Certificate', type: 'string', default: '' },
            { key: 'ssl.key', label: 'SSL Private Key', type: 'string', default: '' },
            { key: 'ssl.key_passphrase', label: 'SSL Key Passphrase', type: 'string', default: '' },
            { key: 'ssl.ca_trusted_fingerprint', label: 'SSL CA Trusted Fingerprint', type: 'string', default: '' },
            {
              key: 'metrics_filters.exclude',
              label: 'Metrics Filters Exclude',
              type: 'stringArray',
              default: [],
            },
            {
              key: 'metrics_filters.include',
              label: 'Metrics Filters Include',
              type: 'stringArray',
              default: [],
            },
            { key: 'username', label: 'Username', type: 'string', default: '' },
            { key: 'password', label: 'Password', type: 'string', default: '' },
            { key: 'connect_timeout', label: 'Connect Timeout', type: 'string', default: '' },
            { key: 'timeout', label: 'Timeout', type: 'string', default: '' },
            { key: 'headers', label: 'Headers', type: 'multiline', default: HEADERS_DEFAULT },
            { key: 'query', label: 'Query', type: 'multiline', default: HTTP_QUERY_DEFAULT },
            {
              key: 'data_stream.dataset',
              label: 'Datastream Dataset Name',
              type: 'string',
              default: 'prometheus.collector',
              required: true,
            },
            { key: 'metrics_count', label: 'Metrics Count', type: 'boolean', default: false },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'custom', label: 'Custom', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'prometheus.query',
          label: 'Query',
          defaultEnabled: false,
          vars: [
            { key: 'hosts', label: 'Hosts', type: 'stringArray', default: ['localhost:9090'], required: true },
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'queries', label: 'Queries', type: 'multiline', default: QUERIES_DEFAULT, required: true },
            { key: 'leaderelection', label: 'Leader Election', type: 'boolean', default: false, required: true },
            {
              key: 'data_stream.dataset',
              label: 'Datastream Dataset Name',
              type: 'string',
              default: 'prometheus.query',
              required: true,
            },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'custom', label: 'Custom', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'prometheus.remote_write',
          label: 'Remote Write',
          defaultEnabled: false,
          vars: [
            { key: 'host', label: 'Host', type: 'string', default: 'localhost', required: true },
            { key: 'port', label: 'Port', type: 'string', default: '9201', required: true },
            { key: 'ssl.enabled', label: 'Enabled SSL', type: 'boolean', default: false, required: true },
            {
              key: 'ssl.certificate',
              label: 'SSL Certificate',
              type: 'string',
              default: '/etc/pki/server/cert.pem',
            },
            { key: 'ssl.key', label: 'SSL Key', type: 'string', default: '/etc/pki/server/cert.key' },
            {
              key: 'ssl.certificate_authorities',
              label: 'SSL Certificate Authorities',
              type: 'stringArray',
              default: [],
            },
            { key: 'period', label: 'Period', type: 'string', default: '1m', required: true },
            { key: 'rate_counters', label: 'Rate Counters', type: 'boolean', default: true, required: true },
            { key: 'use_types', label: 'Use Types', type: 'boolean', default: true, required: true },
            {
              key: 'types_patterns.counter_patterns',
              label: 'Counter Type Patterns',
              type: 'stringArray',
              default: [],
            },
            {
              key: 'types_patterns.histogram_patterns',
              label: 'Histogram Type Patterns',
              type: 'stringArray',
              default: [],
            },
            {
              key: 'data_stream.dataset',
              label: 'Datastream Dataset Name',
              type: 'string',
              default: 'prometheus.remote_write',
              required: true,
            },
            { key: 'metrics_count', label: 'Metrics Count', type: 'boolean', default: false },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'custom', label: 'Custom', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
