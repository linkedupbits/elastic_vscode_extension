import { PackageTemplate } from './packageTemplate';

const WINLOG_CUSTOM = '# Winlog configuration example\n#batch_read_size: 100';
const FILESYSTEM_PROCESSORS =
  '- drop_event.when.regexp:\n    system.filesystem.mount_point: ^/(sys|cgroup|proc|dev|etc|host|lib|snap)($|/)\n';
const FSSTAT_PROCESSORS =
  '- drop_event.when.regexp:\n    system.fsstat.mount_point: ^/(sys|cgroup|proc|dev|etc|host|lib|snap)($|/)\n';

/**
 * Structural template for the Elastic `system` integration package, derived from
 * examples/Integrations/System/*.json (package version 2.3.2). Drives both the default
 * values used when creating a new System integration policy, and the structured editor form.
 * See https://github.com/elastic/integrations/blob/main/packages/system/manifest.yml
 */
export const systemPackageTemplate: PackageTemplate = {
  name: 'system',
  title: 'System',
  version: '2.3.2',
  requiresRoot: true,
  inputs: [
    {
      id: 'system-logfile',
      label: 'Log File (auth / syslog)',
      defaultEnabled: true,
      vars: [
        {
          key: 'condition',
          label: 'Condition',
          type: 'string',
          default:
            '${host.os_version} != "12 (bookworm)" and (${host.os_platform} != "amzn" or ${host.os_version} != "2023")',
        },
      ],
      streams: [
        {
          id: 'system.auth',
          label: 'Auth',
          defaultEnabled: true,
          vars: [
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/auth.log*', '/var/log/secure*'],
            },
            { key: 'preserve_original_event', label: 'Preserve Original Event', type: 'boolean', default: false },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['system-auth'] },
          ],
        },
        {
          id: 'system.syslog',
          label: 'Syslog',
          defaultEnabled: true,
          vars: [
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/messages*', '/var/log/syslog*', '/var/log/system*', '/var/log/maillog*'],
            },
            { key: 'preserve_original_event', label: 'Preserve Original Event', type: 'boolean', default: false },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            { key: 'exclude_files', label: 'Exclude Files', type: 'stringArray', default: ['\\.gz$'] },
          ],
        },
      ],
    },
    {
      id: 'system-journald',
      label: 'Journald (auth / syslog)',
      defaultEnabled: true,
      vars: [
        {
          key: 'condition',
          label: 'Condition',
          type: 'string',
          default:
            '${host.os_version} == "12 (bookworm)" or (${host.os_platform} == "amzn" and ${host.os_version} == "2023")',
        },
      ],
      streams: [
        {
          id: 'system.auth',
          label: 'Auth',
          defaultEnabled: true,
          vars: [
            { key: 'preserve_original_event', label: 'Preserve Original Event', type: 'boolean', default: false },
            { key: 'paths', label: 'Paths', type: 'stringArray', default: [] },
            { key: 'include_matches', label: 'Include Matches', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.syslog',
          label: 'Syslog',
          defaultEnabled: true,
          vars: [
            { key: 'preserve_original_event', label: 'Preserve Original Event', type: 'boolean', default: false },
            { key: 'paths', label: 'Paths', type: 'stringArray', default: [] },
            { key: 'include_matches', label: 'Include Matches', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
      ],
    },
    {
      id: 'system-winlog',
      label: 'Windows Event Log',
      defaultEnabled: false,
      streams: [
        {
          id: 'system.application',
          label: 'Application',
          defaultEnabled: false,
          vars: [
            { key: 'preserve_original_event', label: 'Preserve Original Event', type: 'boolean', default: false },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            { key: 'language', label: 'Language', type: 'number', default: 0 },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'custom', label: 'Custom', type: 'multiline', default: WINLOG_CUSTOM },
          ],
        },
        {
          id: 'system.security',
          label: 'Security',
          defaultEnabled: false,
          vars: [
            { key: 'preserve_original_event', label: 'Preserve Original Event', type: 'boolean', default: false },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            { key: 'language', label: 'Language', type: 'number', default: 0 },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'custom', label: 'Custom', type: 'multiline', default: WINLOG_CUSTOM },
          ],
        },
        {
          id: 'system.system',
          label: 'System',
          defaultEnabled: false,
          vars: [
            { key: 'preserve_original_event', label: 'Preserve Original Event', type: 'boolean', default: false },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            { key: 'language', label: 'Language', type: 'number', default: 0 },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'custom', label: 'Custom', type: 'multiline', default: WINLOG_CUSTOM },
          ],
        },
      ],
    },
    {
      id: 'system-system/metrics',
      label: 'Metrics',
      defaultEnabled: true,
      vars: [],
      streams: [
        {
          id: 'system.core',
          label: 'Core',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'core.metrics', label: 'Core Metrics', type: 'stringArray', default: ['percentages'] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'use_performance_counters', label: 'Use Performance Counters', type: 'boolean', default: false },
          ],
        },
        {
          id: 'system.cpu',
          label: 'CPU',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            {
              key: 'cpu.metrics',
              label: 'CPU Metrics',
              type: 'stringArray',
              default: ['percentages', 'normalized_percentages'],
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'use_performance_counters', label: 'Use Performance Counters', type: 'boolean', default: false },
          ],
        },
        {
          id: 'system.diskio',
          label: 'Disk IO',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'diskio.include_devices', label: 'Include Devices', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.filesystem',
          label: 'Filesystem',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '1m' },
            { key: 'filesystem.ignore_types', label: 'Ignore Types', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: FILESYSTEM_PROCESSORS },
          ],
        },
        {
          id: 'system.fsstat',
          label: 'Filesystem Summary',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '1m' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: FSSTAT_PROCESSORS },
            { key: 'filesystem.ignore_types', label: 'Ignore Types', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.load',
          label: 'Load',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.memory',
          label: 'Memory',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.network',
          label: 'Network',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'network.interfaces', label: 'Interfaces', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.process',
          label: 'Process',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'process.include_top_n.by_cpu', label: 'Include Top N By CPU', type: 'number', default: 5 },
            {
              key: 'process.include_top_n.by_memory',
              label: 'Include Top N By Memory',
              type: 'number',
              default: 5,
            },
            {
              key: 'process.cmdline.cache.enabled',
              label: 'Cmdline Cache Enabled',
              type: 'boolean',
              default: true,
            },
            { key: 'process.cgroups.enabled', label: 'Cgroups Enabled', type: 'boolean', default: false },
            { key: 'process.env.whitelist', label: 'Env Whitelist', type: 'stringArray', default: [] },
            { key: 'process.include_cpu_ticks', label: 'Include CPU Ticks', type: 'boolean', default: false },
            { key: 'processes', label: 'Processes', type: 'stringArray', default: ['.*'] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'degrade_on_partial', label: 'Degrade On Partial', type: 'boolean', default: false },
          ],
        },
        {
          id: 'system.process.summary',
          label: 'Process Summary',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'degrade_on_partial', label: 'Degrade On Partial', type: 'boolean', default: false },
          ],
        },
        {
          id: 'system.socket_summary',
          label: 'Socket Summary',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.uptime',
          label: 'Uptime',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
      ],
    },
  ],
};
