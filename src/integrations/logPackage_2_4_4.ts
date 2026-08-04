import { PackageTemplate } from './packageTemplate';

/**
 * Structural template for the Elastic `log` integration package (Custom Logs (Deprecated),
 * package version 2.4.4), derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/log/log-2.4.4.zip
 *   - manifest.yml (type: input; policy_templates[0]: input type `logfile`, vars)
 * This is an "input package" rather than a regular integration package: its manifest has no
 * `data_stream/*` directories at all, and `policy_templates[0].vars` describes the single
 * stream Fleet creates for it directly (the dataset name is one of those vars), not separate
 * input-level vs stream-level sections. So every var here lives on the one `log.logs` stream,
 * and the `log-logfile` input has no input-level vars of its own.
 */
export const logPackageTemplate_2_4_4: PackageTemplate = {
  name: 'log',
  title: 'Custom Logs (Deprecated)',
  version: '2.4.4',
  inputs: [
    {
      id: 'log-logfile',
      label: 'Custom Log File',
      defaultEnabled: true,
      streams: [
        {
          id: 'log.logs',
          label: 'Log File',
          defaultEnabled: true,
          vars: [
            { key: 'paths', label: 'Paths', type: 'stringArray', default: [], required: true },
            { key: 'exclude_files', label: 'Exclude Files', type: 'stringArray', default: [] },
            { key: 'ignore_older', label: 'Ignore Events Older Than', type: 'string', default: '72h' },
            { key: 'data_stream.dataset', label: 'Dataset Name', type: 'string', default: '', required: true },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'custom', label: 'Custom Configurations', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
