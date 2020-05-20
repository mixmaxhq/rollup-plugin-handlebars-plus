import path from 'path';

import { babel } from '@rollup/plugin-babel';
import jsesc from 'jsesc';
import { rollup } from 'rollup';
import prettier from 'rollup-plugin-prettier';

import helperSource from './helpers.include.js';
import ImportScanner_ from './ImportScanner';

// The default module ID of the Handlebars runtime--the path of its CJS definition within this module.
// Note that it needs to be relative to our consumer's `node_modules` directory not absolute, or
// else we'll bypass the `rollup-plugin-commonjs` configuration of `include: 'node_modules/**'`
// and `rollup-plugin-babel` configuration of `exclude: 'node_modules/**'`.
const consumerNodeModules = path.join(__dirname, '../..');
const DEFAULT_HANDLEBARS_ID = path.relative(
  consumerNodeModules,
  require.resolve('handlebars/runtime')
);

const PLUGIN_HELPER_MODULE_ID = '\0rollupPluginHandlebarsPlusHelpers.js';
const PLUGIN_GENERATED_MODULE_ID = '\0rollupPluginHandlebarsPlusGenerated.js';

function getFormatsFromOptions(options) {
  if (Array.isArray(options.formats)) {
    const formats = {};
    for (const format of options.formats) {
      formats[format] = true;
    }
    return formats;
  }
  return options.formats || {};
}

function getValidFormats(options) {
  const formats = getFormatsFromOptions(options);
  return {
    element: !!formats.element,
    fragment: !!formats.fragment,
    jquery: !!(options.jquery || formats.jquery),
    string: true,
  };
}

/**
 * Constructs a Rollup plugin to compile Handlebars templates.
 *
 * @param {Object} options
 *  @param {String|Object=} options.handlebars - Handlebars options. If this is a string it is a
 *    shortcut for passing `id` as below.
 *   @param {String=} options.handlebars.id - The module ID of the Handlebars runtime. Defaults to
 *     the path of its UMD definition within this module, which guarantees compatibility and will
 *     be simple for you _assuming_ you're using `rollup-plugin-node-resolve` and `rollup-plugin-commonjs`.
 *   @param {Object=} options.handlebars.module - Custom handlebars compiler if the built in version
 *     is not proper. If you pass this, you must also pass `id`, to ensure that the compiler and
 *     runtime versions match.
 *   @param {Object=} options.handlebars.options - Options to pass to Handlebars' parse and precompile
 *     steps.
 *    @param {Boolean=true} options.handlebars.options.sourceMap - Whether to generate sourcemaps.
 *  @param {String|Array<String>=} helpers - The ID(s) of modules to import before every template.
 *    They should export as `default` a single function that accepts the Handlebars runtime as
 *    argument, letting them register helpers. Each such export will only be invoked once.
 *  @param {String='.hbs'} templateExtension - The file extension of your templates.
 *  @param {Function=} isPartial - A function that can determine whether or not a template is a
 *    partial. Defaults to determining if the template's name is prefixed with a '_'.
 *  @param {String|Array<String>=} partialRoot - The absolute paths of the root directory(ies) from
 *    which to try to resolve the partials. You should also register these with `rollup-plugin-root-import`.
 *  @param {String=} jquery - The module ID of jQuery, if you'd like the template functions to
 *    default to returning jQuery collections rather than raw strings. The functions have signature
 *    `(data, options, asString)` so you can still pass `true` for their third argument to render strings.
 *
 * @return {Object} The rollup plugin object, as documented on the wiki:
 *   https://github.com/rollup/rollup/wiki/Plugins#creating-plugins
 */
export function handlebars(options) {
  options = Object.assign(
    {
      templateExtension: '.hbs',
      isPartial: (name) => name.startsWith('_'),
    },
    options
  );

  if (typeof options.handlebars === 'string') {
    options.handlebars = {
      id: options.handlebars,
    };
  } else if (options.handlebars && options.handlebars.module && !options.handlebars.id) {
    throw new Error(
      'Handlebars runtime should be defined in options.handlebars.id, if custom Handlebars compiler is used!'
    );
  } else {
    options.handlebars = {
      id: DEFAULT_HANDLEBARS_ID,
      ...options.handlebars,
    };
  }

  options.handlebars.options = Object.assign(
    {
      sourceMap: true,
    },
    options.handlebars.options
  );

  const Handlebars = options.handlebars.module || require('handlebars');
  const ImportScanner = ImportScanner_(Handlebars);

  const validFormats = getValidFormats(options);

  const jqueryPath =
    typeof options.jquery === 'string' ? options.jquery : validFormats.jquery ? 'jquery' : null;

  const escapePath = (path) => jsesc(path, { minimal: true });

  function generateHelperModule() {
    const defaultFormat = validFormats.jquery ? 'jquery' : 'string';

    // TODO: figure out how to let valid_ get eliminated. It works if it's a bare object.
    let body = `const valid = Object.create(null);\n`;
    for (const [key, value] of Object.entries(validFormats)) {
      if (value) {
        body += `valid.${key} = ${value};\n`;
      }
      // Export a bare copy of the valid boolean so we can do dead code elimination.
      body += `export const ${key}Valid = ${value};\n`;
    }
    body += `export const defaultFormat = ${jsesc(defaultFormat, { wrap: true })};\n`;

    body += `import Handlebars from 'handlebars';\n`;
    if (options.helpers) {
      // Support `helpers` being singular or plural.
      for (const [i, helpers] of [].concat(options.helpers).entries()) {
        body += `import Helpers${i} from '${escapePath(helpers)}';\n`;
        body += `if (!Helpers${i}.__initialized) {\n`;
        body += `  Helpers${i}(Handlebars);\n`;
        body += `  Helpers${i}.__initialized = true;\n`;
        body += `}\n`;
      }
    }
    body += `export { valid, Handlebars };\n`;

    return body;
  }

  return {
    resolveId(id) {
      return id === PLUGIN_HELPER_MODULE_ID ? id : null;
    },

    async load(id) {
      if (id === PLUGIN_HELPER_MODULE_ID) {
        const bundle = await rollup({
          input: 'helpers.js',
          external: (id) =>
            ['handlebars', 'jquery'].includes(id) || id.startsWith('@babel/runtime/'),
          treeshake: {
            moduleSideEffects: 'no-external',
            propertyReadSideEffects: false,
          },
          plugins: [
            {
              resolveId: (id) =>
                ['helpers.js', PLUGIN_GENERATED_MODULE_ID].includes(id) ? id : null,
              load: (id) =>
                id === 'helpers.js'
                  ? helperSource
                  : id === PLUGIN_GENERATED_MODULE_ID
                  ? generateHelperModule()
                  : null,
            },
            babel({
              babelHelpers: options.babelHelpers || 'bundled',
              configFile: false,
              presets: [
                ['@babel/preset-env', { loose: true }],
                // Collapse constants to remove unnecessary code depending on the configuration.
                [
                  'minify',
                  {
                    booleans: false,
                    builtIns: false,
                    mangle: false,
                    simplify: false,
                    simplifyComparisons: false,
                  },
                ],
              ],
              plugins:
                options.babelHelpers === 'runtime'
                  ? [['@babel/plugin-transform-runtime', options.babelRuntime]]
                  : [],
            }),
            prettier({
              // Prefer the configuration in rollup-plugin-handlebars-plus.
              cwd: __dirname,
              filepath: `${__dirname}/helpers.js`,
            }),
          ],
        });

        const { output } = await bundle.generate({
          format: 'es',
          paths: {
            handlebars: options.handlebars.id,
            jquery: jqueryPath,
          },
        });
        // TODO: sourcemaps?
        return output[0];
      }

      if (id !== PLUGIN_GENERATED_MODULE_ID) return null;
    },

    transform(code, id) {
      if (id === PLUGIN_HELPER_MODULE_ID || !id.endsWith(options.templateExtension)) return;

      const name = id.slice(id.lastIndexOf('/') + 1),
        tree = Handlebars.parse(code, options.handlebars.options);

      const scanner = new ImportScanner();
      scanner.accept(tree);

      const precompileOptions = options.handlebars.options;
      if (precompileOptions.sourceMap && !precompileOptions.srcName) {
        precompileOptions.srcName = name;
      }
      let template = Handlebars.precompile(tree, precompileOptions),
        map = null;
      if (precompileOptions.sourceMap) {
        map = template.map;
        template = template.code;
      }

      let body = `import { Handlebars, getFormat, parsers } from '${escapePath(
        PLUGIN_HELPER_MODULE_ID
      )}';\n`;

      for (const partial of scanner.partials) {
        // Register the partial dependencies as partials.
        body += `import '${escapePath(partial)}${options.templateExtension}';\n`;
      }

      body += `var Template = Handlebars.template(${template});\n`;

      if (options.isPartial(name)) {
        let partialName = id;
        if (options.partialRoot) {
          // Support `partialRoot` being singular or plural.
          for (const partialRoot of [].concat(options.partialRoot)) {
            if (id.startsWith(partialRoot)) {
              partialName = partialName.slice(partialRoot.length);
              break;
            }
          }
        }
        if (partialName.endsWith(options.templateExtension)) {
          partialName = partialName.slice(0, -options.templateExtension.length);
        }
        body += `Handlebars.registerPartial('${partialName}', Template);\n`;
      }

      const gen = `Template(data, options)`;

      if (validFormats.element || validFormats.fragment || validFormats.jquery) {
        body += `export default function(data, options, asString) {\n`;
        body += `  var format, parser;\n`;
        body += `  format = getFormat(options, asString);\n`;
        body += `  options = format[0];\n`;
        body += `  format = format[1];\n`;
        body += `  parser = parsers[format];\n`;
        body += `  var html = ${gen};\n`;
        body += `  return parser ? parser(html) : html;\n`;
        body += `};\n`;
      } else {
        body += `export default Template;\n`;
        // body += `  return ${gen};\n`;
      }

      for (const [format, enabled] of Object.entries(validFormats)) {
        if (!enabled) continue;
        body += `export function ${format}(data, options) {\n`;
        body += `  return ${format === 'string' ? gen : `(0, parsers.${format})(${gen})`};\n`;
        body += `}\n`;
      }

      return {
        code: body,
        map: map || { mappings: '' },
      };
    },
  };
}

// In case the consumer needs it.
export const runtimeId = DEFAULT_HANDLEBARS_ID;
