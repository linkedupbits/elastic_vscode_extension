import { PackageTemplate } from './packageTemplate';

const WINLOG_CUSTOM = '# Winlog configuration example\n#batch_read_size: 100';
const FILESYSTEM_PROCESSORS =
  '- drop_event.when.regexp:\n    system.filesystem.mount_point: ^/(sys|cgroup|proc|dev|etc|host|lib|snap)($|/)\n';
const FSSTAT_PROCESSORS =
  '- drop_event.when.regexp:\n    system.fsstat.mount_point: ^/(sys|cgroup|proc|dev|etc|host|lib|snap)($|/)\n';

const LOGFILE_CONDITION =
  '(${host.platform} != "windows") and (${host.os_version} != "12 (bookworm)" and ${host.os_version} != "13 (trixie)" and (${host.os_platform} != "amzn" or ${host.os_version} != "2023") and (${host.os_platform} != "sles" or (${host.os_version} != "15 SP1" and ${host.os_version} != "15-SP1" and ${host.os_version} != "15 SP2" and ${host.os_version} != "15-SP2" and ${host.os_version} != "15 SP3" and ${host.os_version} != "15-SP3" and ${host.os_version} != "15 SP4" and ${host.os_version} != "15-SP4" and ${host.os_version} != "15 SP5" and ${host.os_version} != "15-SP5" and ${host.os_version} != "15 SP6" and ${host.os_version} != "15-SP6" and ${host.os_version} != "15 SP7" and ${host.os_version} != "15-SP7" and ${host.os_version} != "16.0")))';
const JOURNALD_CONDITION =
  '(${host.platform} != "windows") and (${host.os_version} == "12 (bookworm)" or ${host.os_version} == "13 (trixie)" or (${host.os_platform} == "amzn" and ${host.os_version} == "2023") or (${host.os_platform} == "sles" and (${host.os_version} == "15 SP1" or ${host.os_version} == "15-SP1" or ${host.os_version} == "15 SP2" or ${host.os_version} == "15-SP2" or ${host.os_version} == "15 SP3" or ${host.os_version} == "15-SP3" or ${host.os_version} == "15 SP4" or ${host.os_version} == "15-SP4" or ${host.os_version} == "15 SP5" or ${host.os_version} == "15-SP5" or ${host.os_version} == "15 SP6" or ${host.os_version} == "15-SP6" or ${host.os_version} == "15 SP7" or ${host.os_version} == "15-SP7" or ${host.os_version} == "16.0")))';

/**
 * Structural template for the Elastic `system` integration package at package version 2.21.0,
 * registered alongside `systemPackageTemplate_2_22_1` (2.22.1), `systemPackageTemplate_2_6_3`
 * (2.6.3) and `systemPackageTemplate_2_3_2` (2.3.2) so policies pinned to 2.21.0 get a
 * structured editor too. Derived from the published package registry snapshot:
 * https://epr.elastic.co/epr/system/system-2.21.0.zip
 *   - manifest.yml (policy_templates: input types + input-level vars)
 *   - data_stream/{auth,syslog,application,security,system}/manifest.yml (log streams)
 *   - data_stream/{core,cpu,diskio,filesystem,fsstat,load,memory,network,ntp,process,
 *     process_summary,socket_summary,uptime}/manifest.yml (metric streams)
 * Verified byte-for-byte structurally identical to 2.22.1 (manifest.yml and every data stream
 * manifest differ only in the `version:` field) - the OS-match logfile/journald conditions,
 * the `ntp` stream, and every var/default/required flag are unchanged from 2.22.1.
 * `requiresRoot` on a stream mirrors that data stream's `agent.privileges.root: true`
 * (only auth, syslog and diskio declare it); the policy-level `requires_root` is computed
 * from currently-enabled streams rather than hardcoded, see `computeRequiresRoot`.
 */
export const systemPackageTemplate_2_21_0: PackageTemplate = {
  name: 'system',
  title: 'System',
  version: '2.21.0',
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
          id: 'system.ntp',
          label: 'NTP',
          defaultEnabled: false,
          vars: [
            { key: 'period', label: 'Period', type: 'string', default: '10s', required: true },
            {
              key: 'ntp.servers',
              label: 'NTP Servers',
              type: 'stringArray',
              default: ['pool.ntp.org'],
              required: true,
            },
            { key: 'ntp.timeout', label: 'Timeout', type: 'string', default: '5s', required: true },
            {
              key: 'ntp.version',
              label: 'NTP Version',
              type: 'select',
              default: '4',
              required: true,
              options: [
                { value: '3', label: '3' },
                { value: '4', label: '4' },
              ],
            },
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
