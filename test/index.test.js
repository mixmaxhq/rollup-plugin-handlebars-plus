import { node } from 'execa';
import { rollup } from 'rollup';

import { handlebars, runtimeId } from '..';

describe('helpers', () => {
  it('should produce a valid helper module', async () => {
    const jquery = '/path/to/jquery';
    const plugin = handlebars({
      templateExtension: '.html',
      formats: ['element', 'fragment'],
      jquery,
    });
    const output = await plugin.load('\0rollupPluginHandlebarsPlusHelpers.js');
    expect(output.imports).toContain('jquery');
    // This should get included in the bundle.
    expect(output.imports).not.toContain('\0rollupPluginHandlebarsPlusGenerated.js');
    expect(new Set(output.exports)).toEqual(
      new Set(['Handlebars', 'getFormat', 'parsers', 'rangeForParsing'])
    );
  });

  it('should treeshake the helper module', async () => {
    const plugin = handlebars({ templateExtension: '.html' });
    const output = await plugin.load('\0rollupPluginHandlebarsPlusHelpers.js');
    expect(output.imports).not.toContain('jquery');
    expect(new Set(output.exports)).toEqual(
      new Set(['Handlebars', 'getFormat', 'parsers', 'rangeForParsing'])
    );
  });
});

async function generateBundle(fixtureName, options, inputOptions = {}, outputOptions = {}) {
  const externals = new Set([
    '\0rollupPluginHandlebarsPlusGenerated.js',
    runtimeId,
    ...(inputOptions.external || []),
  ]);
  const bundle = await rollup({
    input: `${__dirname}/fixtures/${fixtureName}`,
    external: (id) => externals.has(id) || id.startsWith('@babel/runtime/'),
    treeshake: {
      moduleSideEffects: 'no-external',
      propertyReadSideEffects: false,
    },
    plugins: [handlebars(options)],
  });

  const { output } = await bundle.generate({ format: 'es', ...outputOptions });
  return output[0];
}

describe('bundling', () => {
  it('should generate templates', async () => {
    const jquery = '/other/path/to/jquery';

    const output = await generateBundle('simple.hbs', { jquery }, { external: [jquery] });

    expect(output.imports).toContain(jquery);
    expect(new Set(output.exports)).toEqual(new Set(['default', 'jquery', 'string']));
  });

  it('should generate named exports per format', async () => {
    const output = await generateBundle(
      'simple.hbs',
      { formats: ['element', 'fragment', 'jquery'] },
      { external: ['jquery'] }
    );

    expect(output.imports).toContain('jquery');
    expect(new Set(output.exports)).toEqual(
      new Set(['default', 'element', 'fragment', 'jquery', 'string'])
    );
  });

  it('should not include the named jquery export when not allowed', async () => {
    const output = await generateBundle('simple.hbs');

    expect(output.exports).toContain('string');
    expect(output.exports).not.toContain('jquery');
  });

  it('should support runtime babel helpers', async () => {
    const output = await generateBundle('simple.hbs', {
      babelHelpers: 'runtime',
      formats: ['element'],
    });

    expect(
      output.imports.some((id) => id === '@babel/runtime' || id.startsWith('@babel/runtime/'))
    ).toBe(true);
  });
});

async function generateAndEvaluate(fixture, options = {}, inputOptions = {}, outputOptions = {}) {
  const { code } = await generateBundle(
    fixture,
    { ...options, handlebars: { id: 'handlebars/runtime', ...options.handlebars } },
    { ...inputOptions, external: ['handlebars/runtime', ...(inputOptions.external || [])] },
    { format: 'cjs', ...outputOptions }
  );

  // TODO: figure out a method for evaluating the generated bundles that lets us directly invoke the
  // template from jest-land.
  return node('--', [], { input: code }).then(({ stdout }) => stdout);
}

describe('functionality', () => {
  it('should produce the expected string', async () => {
    await expect(generateAndEvaluate('print-simple.js')).resolves.toBe('<div></div>');
  });

  it('should produce an interpolated string', async () => {
    await expect(generateAndEvaluate('print-interpolate.js')).resolves.toMatch(
      /^<div>\s*<p>Hi, Human<\/p>\s*<\/div>$/
    );
  });
});
