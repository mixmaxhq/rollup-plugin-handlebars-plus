const path = require('path');
const jsesc = require('jsesc');

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
function handlebars(options) {
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
  const ImportScanner = require('./ImportScanner')(Handlebars);

  const validFormats = getValidFormats(options),
    usesFragmentParsing = validFormats.element || validFormats.fragment;

  const jqueryPath =
    typeof options.jquery === 'string' ? options.jquery : validFormats.jquery ? 'jquery' : null;

  return {
    resolveId(id) {
      return id === PLUGIN_HELPER_MODULE_ID ? id : null;
    },

    load(id) {
      if (id !== PLUGIN_HELPER_MODULE_ID) return null;

      const defaultFormat = validFormats.jquery ? "'jquery'" : "'string'";

      let body = `const valid = Object.create(null);\n`;
      for (const [key, value] of Object.entries(validFormats)) {
        body += `valid.${key} = ${value};\n`;
      }
      body += `const hasOwn = Object.prototype.hasOwnProperty;\n`;
      if (usesFragmentParsing) {
        body += `export const rangeForParsing = document.createRange();\n`;
      }
      if (validFormats.element) {
        body += `function parseElement(html) {\n`;
        body += `  const children = rangeForParsing.createContextualFragment(html).children;\n`;
        body += `  if (children.length !== 1) throw new Error('element format received ' + `;
        body += `children.length + 'elements, needs exactly one');\n`;
        body += `  return children[0];\n`;
        body += `}\n`;
      }
      if (validFormats.fragment) {
        body += `function parseFragment(html) {\n`;
        body += `  return rangeForParsing.createContextualFragment(html);\n`;
        body += `}\n`;
      }
      body += `export function getFormat(options, asString) {\n`;
      body += `  if (asString !== void 0) return [options, ${
        validFormats.jquery ? "!asString ? 'jquery' : " : ''
      }'string'];\n`;
      body += `  if (!options) return [options, ${defaultFormat}];\n`;
      body += `  var format = options.format || ${defaultFormat};\n`;
      body += `  if (!valid[format]) throw new TypeError('unsupported format ' + format);\n`;
      body += `  var restOptions = {};\n`;
      body += `  for (const key in options) {\n`;
      body += `    if (hasOwn.call(options, key) && key !== 'format') {\n`;
      body += `      restOptions[key] = options[key];\n`;
      body += `    }\n`;
      body += `  }\n`;
      body += `  return [restOptions, format];\n`;
      body += `}\n`;
      body += `export const parsers = {\n`;
      const parsers = [];
      if (validFormats.element) parsers.push('  element: parseElement');
      if (validFormats.fragment) parsers.push('  fragment: parseFragment');
      if (validFormats.jquery) parsers.push('  jquery: $');
      body += parsers.join(',\n') + '\n';
      body += `}\n;`;

      return body;
    },

    transform(code, id) {
      if (id === PLUGIN_HELPER_MODULE_ID || !id.endsWith(options.templateExtension)) return;

      const name = id.split('/').pop(),
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

      const escapePath = (path) => jsesc(path, { minimal: true, wrap: true });

      let body = `import Handlebars from ${escapePath(options.handlebars.id)};\n`;
      if (jqueryPath) body += `import $ from ${escapePath(jqueryPath)};\n`;
      body += `import { getFormat, parsers } from ${escapePath(PLUGIN_HELPER_MODULE_ID)};\n`;

      if (options.helpers) {
        // Support `helpers` being singular or plural.
        for (const [i, helpers] of [].concat(options.helpers).entries()) {
          body += `import Helpers${i} from ${escapePath(helpers)};\n`;
          body += `if (!Helpers${i}.__initialized) {\n`;
          body += `  Helpers${i}(Handlebars);\n`;
          body += `  Helpers${i}.__initialized = true;\n`;
          body += `}\n`;
        }
      }

      for (const partial of scanner.partials) {
        // Register the partial dependencies as partials.
        body += `import ${escapePath(partial)}${options.templateExtension};\n`;
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

      body += `export default function(data, options, asString) {\n`;
      if (validFormats.element || validFormats.fragment || validFormats.jquery) {
        body += `  var format, parser;\n`;
        body += `  format = getFormat(options, asString);\n`;
        body += `  options = format[0];\n`;
        body += `  format = format[1];\n`;
        body += `  parser = parsers[format];\n`;
      }
      body += `  var html = Template(data, options);\n`;
      body += `  return parser ? parser(html) : html;\n`;
      body += `};\n`;

      for (const [format, enabled] of Object.entries(validFormats)) {
        if (!enabled) continue;
        body += `export function ${format}(data, options) {\n`;
        body += `  var html = Template(data, options);\n`;
        body += `  return (0, parsers.${format})(html);\n`;
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
handlebars.runtimeId = DEFAULT_HANDLEBARS_ID;

module.exports = handlebars;
