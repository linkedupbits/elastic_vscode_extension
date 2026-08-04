import { PackageTemplate } from './packageTemplate';

const WINLOG_CUSTOM = '# Winlog configuration example\n#batch_read_size: 100';
const FILESYSTEM_PROCESSORS =
  '- drop_event.when.regexp:\n    system.filesystem.mount_point: ^/(sys|cgroup|proc|dev|etc|host|lib|snap)($|/)\n';
const FSSTAT_PROCESSORS =
  '- drop_event.when.regexp:\n    system.fsstat.mount_point: ^/(sys|cgroup|proc|dev|etc|host|lib|snap)($|/)\n';

const LOGFILE_CONDITION =
  '${host.os_version} != "12 (bookworm)" and (${host.os_platform} != "amzn" or ${host.os_version} != "2023") and (${host.os_platform} != "sles" and startsWith(${host.os_version}, "15") == false)';
const JOURNALD_CONDITION =
  '${host.os_version} == "12 (bookworm)" or (${host.os_platform} == "amzn" and ${host.os_version} == "2023") or (${host.os_platform} == "sles" and startsWith(${host.os_version}, "15") == true)';

/**
 * Structural template for the Elastic `system` integration package at the older package
 * version 2.3.2, registered alongside `systemPackageTemplate` (2.22.1) so policies still
 * pinned to 2.3.2 get a structured editor too. Derived from the published package registry
 * snapshot: https://epr.elastic.co/package/system/2.3.2/ (manifest.yml + each
 * data_stream manifest.yml). Notable differences from 2.22.1: no `ntp` metrics stream
 * (added in a later release) and simpler logfile/journald OS-match conditions (no Debian 13
 * "trixie" / multiple SLES service-pack branches yet).
 * `requiresRoot` mirrors `agent.privileges.root: true` (auth, syslog, diskio only); the
 * policy-level `requires_root` is computed from currently-enabled streams, see
 * `computeRequiresRoot`.
 */
export const systemPackageTemplate_2_3_2: PackageTemplate = {
  name: 'system',
  title: 'System',
  version: '2.3.2',
  inputs: [
    {
      id: 'system-logfile',
      label: 'Log File (auth / syslog)',
      defaultEnabled: true,
      vars: [{ key: 'condition', label: 'Condition', type: 'string', default: LOGFILE_CONDITION }],
      streams: [
        {
          id: 'system.auth',
          label: 'Auth',
          defaultEnabled: true,
          requiresRoot: true,
          vars: [
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/auth.log*', '/var/log/secure*'],
              required: true,
            },
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['system-auth'] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.syslog',
          label: 'Syslog',
          defaultEnabled: true,
          requiresRoot: true,
          vars: [
            {
              key: 'paths',
              label: 'Paths',
              type: 'stringArray',
              default: ['/var/log/messages*', '/var/log/syslog*', '/var/log/system*'],
              required: true,
            },
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
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
      vars: [{ key: 'condition', label: 'Condition', type: 'string', default: JOURNALD_CONDITION }],
      streams: [
        {
          id: 'system.auth',
          label: 'Auth',
          defaultEnabled: true,
          requiresRoot: true,
          vars: [
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'paths', label: 'Paths', type: 'stringArray', default: [] },
            { key: 'include_matches', label: 'Include Matches', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
          ],
        },
        {
          id: 'system.syslog',
          label: 'Syslog',
          defaultEnabled: true,
          requiresRoot: true,
          vars: [
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'paths', label: 'Paths', type: 'stringArray', default: [] },
            { key: 'include_matches', label: 'Include Matches', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
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
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'event_id', label: 'Event ID', type: 'string', default: '' },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            { key: 'language', label: 'Language', type: 'number', default: 0 },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'custom', label: 'Custom', type: 'multiline', default: WINLOG_CUSTOM },
          ],
        },
        {
          id: 'system.security',
          label: 'Security',
          defaultEnabled: false,
          vars: [
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'event_id', label: 'Event ID', type: 'string', default: '' },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            { key: 'language', label: 'Language', type: 'number', default: 0 },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'custom', label: 'Custom', type: 'multiline', default: WINLOG_CUSTOM },
          ],
        },
        {
          id: 'system.system',
          label: 'System',
          defaultEnabled: false,
          vars: [
            {
              key: 'preserve_original_event',
              label: 'Preserve Original Event',
              type: 'boolean',
              default: false,
              required: true,
            },
            { key: 'event_id', label: 'Event ID', type: 'string', default: '' },
            { key: 'ignore_older', label: 'Ignore Older', type: 'string', default: '72h' },
            { key: 'language', label: 'Language', type: 'number', default: 0 },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'custom', label: 'Custom', type: 'multiline', default: WINLOG_CUSTOM },
          ],
        },
      ],
    },
    {
      id: 'system-system/metrics',
      label: 'Metrics',
      defaultEnabled: true,
      vars: [
        { key: 'system.hostfs', label: 'Proc Filesystem Directory', type: 'string', default: '' },
      ],
      streams: [
        {
          id: 'system.core',
          label: 'Core',
          defaultEnabled: false,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'core.metrics',
              label: 'Core Metrics',
              type: 'stringArray',
              default: ['percentages'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'use_performance_counters', label: 'Use Performance Counters', type: 'boolean', default: false },
          ],
        },
        {
          id: 'system.cpu',
          label: 'CPU',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'cpu.metrics',
              label: 'CPU Metrics',
              type: 'stringArray',
              default: ['percentages', 'normalized_percentages'],
              required: true,
            },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
            { key: 'use_performance_counters', label: 'Use Performance Counters', type: 'boolean', default: false },
          ],
        },
        {
          id: 'system.diskio',
          label: 'Disk IO',
          defaultEnabled: true,
          requiresRoot: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'diskio.include_devices', label: 'Include Devices', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.filesystem',
          label: 'Filesystem',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '1m', required: true },
            { key: 'filesystem.ignore_types', label: 'Ignore Types', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            {
              key: 'processors',
              label: 'Processors',
              type: 'multiline',
              default: FILESYSTEM_PROCESSORS,
              required: true,
            },
          ],
        },
        {
          id: 'system.fsstat',
          label: 'Filesystem Summary',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '1m', required: true },
            { key: 'filesystem.ignore_types', label: 'Ignore Types', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            {
              key: 'processors',
              label: 'Processors',
              type: 'multiline',
              default: FSSTAT_PROCESSORS,
              required: true,
            },
          ],
        },
        {
          id: 'system.load',
          label: 'Load',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.memory',
          label: 'Memory',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.network',
          label: 'Network',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'network.interfaces', label: 'Interfaces', type: 'stringArray', default: [] },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.process',
          label: 'Process',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'process.include_top_n.by_cpu',
              label: 'Include Top N By CPU',
              type: 'number',
              default: 5,
              required: true,
            },
            {
              key: 'process.include_top_n.by_memory',
              label: 'Include Top N By Memory',
              type: 'number',
              default: 5,
              required: true,
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
            { key: 'degrade_on_partial', label: 'Degrade On Partial', type: 'boolean', default: false },
            { key: 'processes', label: 'Processes', type: 'stringArray', default: ['.*'], required: true },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.process.summary',
          label: 'Process Summary',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'degrade_on_partial', label: 'Degrade On Partial', type: 'boolean', default: false },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.socket_summary',
          label: 'Socket Summary',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
        {
          id: 'system.uptime',
          label: 'Uptime',
          defaultEnabled: true,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: [] },
            { key: 'processors', label: 'Processors', type: 'multiline', default: '' },
          ],
        },
      ],
    },
  ],
};
