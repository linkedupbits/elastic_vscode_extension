import {
  buildDefaultInputs,
  buildDefaultIntegrationPolicy,
  computeRequiresRoot,
  findMissingRequiredVars,
  mergeInputsWithTemplate,
  PackageTemplate,
} from '../../src/integrations/packageTemplate';
import { IntegrationInputValue } from '../../src/models';

/**
 * Synthetic template exercising every mechanic the generic engine supports (input-level vars
 * present vs. omitted, every var type, `required`, per-stream `requiresRoot`), independent of
 * any real package's data — real package fidelity is covered by systemPackage/nginxPackage tests.
 */
const fixtureTemplate: PackageTemplate = {
  name: 'fixture',
  title: 'Fixture',
  version: '1.0.0',
  inputs: [
    {
      id: 'fixture-alpha',
      label: 'Alpha',
      defaultEnabled: true,
      vars: [
        { key: 'condition', label: 'Condition', type: 'string', default: 'default-condition' },
        { key: 'mode', label: 'Mode', type: 'string', default: '', required: true },
      ],
      streams: [
        {
          id: 'fixture.one',
          label: 'One',
          defaultEnabled: true,
          requiresRoot: true,
          vars: [
            { key: 'path', label: 'Path', type: 'string', default: '/default', required: true },
            { key: 'tags', label: 'Tags', type: 'stringArray', default: ['a'], required: true },
            { key: 'flag', label: 'Flag', type: 'boolean', default: false },
          ],
        },
        {
          id: 'fixture.two',
          label: 'Two',
          defaultEnabled: false,
          vars: [{ key: 'count', label: 'Count', type: 'number', default: 5, required: true }],
        },
      ],
    },
    {
      id: 'fixture-beta',
      label: 'Beta',
      defaultEnabled: false,
      // no `vars`: this input type has no input-level vars section at all.
      streams: [
        {
          id: 'fixture.three',
          label: 'Three',
          defaultEnabled: false,
          vars: [{ key: 'note', label: 'Note', type: 'multiline', default: '' }],
        },
      ],
    },
  ],
};

describe('buildDefaultInputs', () => {
  it('creates one entry per input and per stream, with defaultEnabled flags', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);

    expect(Object.keys(inputs).sort()).toEqual(['fixture-alpha', 'fixture-beta']);
    expect(inputs['fixture-alpha'].enabled).toBe(true);
    expect(inputs['fixture-beta'].enabled).toBe(false);
    expect(inputs['fixture-alpha'].streams['fixture.one'].enabled).toBe(true);
    expect(inputs['fixture-alpha'].streams['fixture.two'].enabled).toBe(false);
  });

  it('populates every var with its template default', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    expect(inputs['fixture-alpha'].vars).toEqual({ condition: 'default-condition', mode: '' });
    expect(inputs['fixture-alpha'].streams['fixture.one'].vars).toEqual({
      path: '/default',
      tags: ['a'],
      flag: false,
    });
  });

  it('omits the `vars` key entirely for an input with no vars defined', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    expect('vars' in inputs['fixture-beta']).toBe(false);
  });

  it('includes `vars` for an input that declares vars, even though defaults are non-empty', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    expect('vars' in inputs['fixture-alpha']).toBe(true);
  });
});

describe('mergeInputsWithTemplate', () => {
  it('with no existing data, equals buildDefaultInputs', () => {
    expect(mergeInputsWithTemplate(fixtureTemplate, undefined)).toEqual(buildDefaultInputs(fixtureTemplate));
  });

  it('preserves explicit values and backfills anything missing from a partial object', () => {
    const partial: Record<string, IntegrationInputValue> = {
      'fixture-alpha': {
        enabled: false,
        vars: { mode: 'custom-mode' } as never,
        streams: {
          'fixture.one': { enabled: true, vars: { path: '/custom' } },
        },
      },
    };

    const merged = mergeInputsWithTemplate(fixtureTemplate, partial);

    expect(merged['fixture-alpha'].enabled).toBe(false);
    expect(merged['fixture-alpha'].vars).toEqual({ condition: 'default-condition', mode: 'custom-mode' });
    expect(merged['fixture-alpha'].streams['fixture.one'].vars).toEqual({
      path: '/custom',
      tags: ['a'],
      flag: false,
    });
    // Stream not present in the partial input still gets full template defaults.
    expect(merged['fixture-alpha'].streams['fixture.two']).toEqual({ enabled: false, vars: { count: 5 } });
    // Input entirely absent from the partial object still appears, from template defaults.
    expect(merged['fixture-beta']).toEqual(buildDefaultInputs(fixtureTemplate)['fixture-beta']);
  });

  it('still omits `vars` for a vars-less input regardless of what the existing data contains', () => {
    const partial = {
      'fixture-beta': { enabled: true, vars: { bogus: 'should be dropped' } as never, streams: {} },
    } as unknown as Record<string, IntegrationInputValue>;

    const merged = mergeInputsWithTemplate(fixtureTemplate, partial);

    expect('vars' in merged['fixture-beta']).toBe(false);
  });
});

describe('findMissingRequiredVars', () => {
  it('flags a required var left at its (empty) default on an enabled input/stream', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    const errors = findMissingRequiredVars(fixtureTemplate, inputs);

    // 'mode' (input-level, default '') and 'path' is filled (default '/default' is non-empty)
    expect(errors).toEqual(['Alpha: "Mode" is required.']);
  });

  it('does not flag a required var on a disabled stream', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].vars = { condition: 'x', mode: 'filled' };
    inputs['fixture-alpha'].streams['fixture.one'].enabled = false;
    inputs['fixture-alpha'].streams['fixture.one'].vars.path = '';

    expect(findMissingRequiredVars(fixtureTemplate, inputs)).toEqual([]);
  });

  it('does not flag a required var when the owning input is disabled, even if the stream itself says enabled', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].vars = { condition: 'x', mode: 'filled' };
    inputs['fixture-alpha'].enabled = false;
    inputs['fixture-alpha'].streams['fixture.one'].enabled = true;
    inputs['fixture-alpha'].streams['fixture.one'].vars.path = '';

    expect(findMissingRequiredVars(fixtureTemplate, inputs)).toEqual([]);
  });

  it('flags a required stream-level var independently of input-level vars', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].vars = { condition: 'x', mode: 'filled' };
    inputs['fixture-alpha'].streams['fixture.one'].vars.path = '   ';

    expect(findMissingRequiredVars(fixtureTemplate, inputs)).toEqual(['Alpha / One: "Path" is required.']);
  });

  it('treats an empty array as missing for a required stringArray var', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].vars = { condition: 'x', mode: 'filled' };
    inputs['fixture-alpha'].streams['fixture.one'].vars.tags = [];

    expect(findMissingRequiredVars(fixtureTemplate, inputs)).toEqual(['Alpha / One: "Tags" is required.']);
  });

  it('treats an entirely missing var (undefined) as missing for a required field', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].vars = { condition: 'x' } as never; // 'mode' key omitted entirely

    expect(findMissingRequiredVars(fixtureTemplate, inputs)).toEqual(['Alpha: "Mode" is required.']);
  });

  it('handles an enabled input with no `vars` section at all without throwing', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].enabled = false;
    inputs['fixture-beta'].enabled = true;

    expect(findMissingRequiredVars(fixtureTemplate, inputs)).toEqual([]);
  });

  it('never flags a required number field as missing, even 0 (numbers are never considered "empty")', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].vars = { condition: 'x', mode: 'filled' };
    inputs['fixture-alpha'].streams['fixture.two'].enabled = true;
    inputs['fixture-alpha'].streams['fixture.two'].vars.count = 0;

    expect(findMissingRequiredVars(fixtureTemplate, inputs)).toEqual([]);
  });
});

describe('computeRequiresRoot', () => {
  it('is true when an enabled stream on an enabled input requires root', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    expect(computeRequiresRoot(fixtureTemplate, inputs)).toBe(true);
  });

  it('is false once the root-requiring stream is disabled', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].streams['fixture.one'].enabled = false;
    expect(computeRequiresRoot(fixtureTemplate, inputs)).toBe(false);
  });

  it('is false when the owning input is disabled, even if the root-requiring stream says enabled', () => {
    const inputs = buildDefaultInputs(fixtureTemplate);
    inputs['fixture-alpha'].enabled = false;
    inputs['fixture-alpha'].streams['fixture.one'].enabled = true;
    expect(computeRequiresRoot(fixtureTemplate, inputs)).toBe(false);
  });

  it('is false for a template where no stream declares requiresRoot', () => {
    const noRootTemplate: PackageTemplate = {
      ...fixtureTemplate,
      inputs: fixtureTemplate.inputs.map((i) => ({
        ...i,
        streams: i.streams.map((s) => ({ ...s, requiresRoot: undefined })),
      })),
    };
    const inputs = buildDefaultInputs(noRootTemplate);
    expect(computeRequiresRoot(noRootTemplate, inputs)).toBe(false);
  });
});

describe('buildDefaultIntegrationPolicy', () => {
  it('produces a fully-formed policy skeleton tied to the given agent policy id', () => {
    const policy = buildDefaultIntegrationPolicy(fixtureTemplate, 'agent-123');

    expect(policy.name).toBe('');
    expect(policy.namespace).toBe('');
    expect(policy.description).toBe('');
    expect(policy.package).toEqual({
      name: 'fixture',
      title: 'Fixture',
      version: '1.0.0',
      requires_root: true,
    });
    expect(policy.policy_id).toBe('agent-123');
    expect(policy.policy_ids).toEqual(['agent-123']);
    expect(policy.inputs).toEqual(buildDefaultInputs(fixtureTemplate));
    expect(policy.output_id).toBeNull();
    expect(policy.vars).toEqual({});
  });
});
