/* globals document */

import $ from 'jquery';

import {
  defaultFormat,
  elementValid,
  fragmentValid,
  jqueryValid,
  valid,
} from '\0rollupPluginHandlebarsPlusGenerated.js';

if ((elementValid || fragmentValid) && typeof document === 'undefined') {
  throw new Error('element or fragment enabled, but no document available');
}

export const rangeForParsing = /*@__PURE__*/ document.createRange();

function parseElement(html) {
  const children = rangeForParsing.createContextualFragment(html).children;
  if (children.length !== 1) {
    throw new Error('element format received ' + children.length + 'elements, needs exactly one');
  }
  return children[0];
}

function parseFragment(html) {
  return rangeForParsing.createContextualFragment(html);
}

export const parsers = {};
if (elementValid) parsers.element = parseElement;
if (fragmentValid) parsers.fragment = parseFragment;
if (jqueryValid) parsers.jquery = $;

export function getFormat(options, asString) {
  if (asString !== undefined) return [options, jqueryValid && !asString ? 'jquery' : 'string'];
  if (!options) return [options, defaultFormat];
  const { format: formatIn, ...restOptions } = options;
  const format = formatIn || defaultFormat;
  if (!valid[format]) throw new TypeError('unsupported format ' + format);
  return [restOptions, format];
}

export { Handlebars } from '\0rollupPluginHandlebarsPlusGenerated.js';
