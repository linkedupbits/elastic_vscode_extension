import { PackageTemplate } from './packageTemplate';

const PARSERS_DEFAULT =
  '#- ndjson:\n#    target: ""\n#    message_key: msg\n#- multiline:\n#    type: count\n#    count_lines: 3\n';

/**
 * Structural template for the Elastic `filestream` integration package (package version
 * 1.1.5), derived from the package source of truth on the Elastic Package Registry:
 * https://epr.elastic.co/epr/filestream/filestream-1.1.5.zip
 *   - manifest.yml (policy_templates: single `filestream` input type, no input-level vars)
 *   - data_stream/generic/manifest.yml (the single `generic` stream, all vars live here)
 * Custom Logs is a generic single-input-type collector: one input, one stream, no
 * `agent.privileges.root` block, so `requiresRoot` never applies here.
 */
export const filestreamPackageTemplate_1_1_5: PackageTemplate = {
  name: 'filestream',
  title: 'Custom Logs (Filestream)',
  version: '1.1.5',
  inputs: [
    {
      id: 'filestream-filestream',
      label: 'Log File (Generic)',
      defaultEnabled: true,
      streams: [
        {
          id: 'filestream.generic',
          label: 'Generic',
          defaultEnabled: true,
          vars: [
            { key: 'paths', label: 'Paths', type: 'stringArray', default: ['/var/log/*.log'], required: true },
            {
              key: 'data_stream.dataset',
              label: 'Dataset name',
              type: 'string',
              default: 'filestream.generic',
              required: true,
            },
            { key: 'pipeline', label: 'Ingest Pipeline', type: 'string', default: '' },
            { key: 'parsers', label: 'Parsers', type: 'multiline', default: PARSERS_DEFAULT },
            { key: 'exclude_files', label: 'Exclude Files', type: 'stringArray', default: ['\\.gz$'] },
            { key: 'include_files', label: 'Include Files', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'encoding', label: 'Encoding', type: 'string', default: '' },
            { key: 'recursive_glob', label: 'Recursive Glob', type: 'boolean', default: true },
            { key: 'symlinks', label: 'Enable symlinks', type: 'boolean', default: false },
            { key: 'resend_on_touch', label: 'Resend on touch', type: 'boolean', default: false },
            { key: 'check_interval', label: 'Check Interval', type: 'string', default: '' },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '' },
            { key: 'ignore_inactive', label: 'Ignore Inactive', type: 'string', default: '' },
            {
              key: 'close_on_state_changed_inactive',
              label: 'Close on State Changed Inactive',
              type: 'string',
              default: '',
            },
            {
              key: 'close_on_state_changed_renamed',
              label: 'Close on State Changed Renamed',
              type: 'boolean',
              default: false,
            },
            {
              key: 'close_on_state_changed_removed',
              label: 'Close on State Changed Removed',
              type: 'boolean',
              default: false,
            },
            { key: 'close_reader_eof', label: 'Close Reader EOF', type: 'boolean', default: false },
            { key: 'close_reader_after_interval', label: 'Close Reader After Interval', type: 'string', default: '' },
            { key: 'clean_inactive', label: 'Clean Inactive', type: 'string', default: '-1' },
            { key: 'clean_removed', label: 'Clean Removed', type: 'boolean', default: false },
            { key: 'harvester_limit', label: 'Harvester Limit', type: 'number', default: 0 },
            { key: 'backoff_init', label: 'Backoff Init', type: 'string', default: '' },
            { key: 'backoff_max', label: 'Backoff Max', type: 'string', default: '' },
            { key: 'fingerprint', label: 'Fingerprint file identity', type: 'boolean', default: true },
            { key: 'fingerprint_offset', label: 'Fingerprint offset', type: 'number', default: 0 },
            { key: 'fingerprint_length', label: 'Fingerprint length', type: 'number', default: 1024 },
            {
              key: 'rotation_external_strategy_copytruncate',
              label: 'Rotation Strategy',
              type: 'multiline',
              default: '',
            },
            { key: 'exclude_lines', label: 'Exclude Lines', type: 'stringArray', default: [] },
            { key: 'include_lines', label: 'Include Lines', type: 'stringArray', default: [] },
            { key: 'buffer_size', label: 'Buffer Size', type: 'string', default: '' },
            { key: 'message_max_bytes', label: 'Message Max Bytes', type: 'string', default: '' },
            { key: 'condition', label: 'Condition', type: 'string', default: '' },
          ],
        },
      ],
    },
  ],
};
