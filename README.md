# rollup-plugin-handlebars-plus

[Rollup](http://rollupjs.org/) plugin to precompile and resolve Handlebars templates.

Features:

- Import Handlebars templates as ES6 modules
- Support for Handlebars [helpers](#helpers) and partials
- [Precompiles](http://handlebarsjs.com/precompilation.html) templates so your application only needs the Handlebars runtime
- Handlebars runtime [included](#handlebars)
- Optional rendering to [jQuery collections](#jquery) vs. raw strings

## Installation

`npm install rollup-plugin-handlebars-plus`
or
`npm install rollup-plugin-handlebars-plus --save`

To use the plugin's copy of the Handlebars runtime, you'll also need to do:

`npm install rollup-plugin-node-resolve rollup-plugin-commonjs`
or
`npm install rollup-plugin-node-resolve rollup-plugin-commonjs --save`

See [here](#handlebars) for more information.

## Usage

```js
import { rollup } from 'rollup';
import { handlebars } from 'rollup-plugin-handlebars-plus';
import rootImport from 'rollup-plugin-root-import';

const partialRoots = [`${__dirname}/src/client/js/views/`, `${__dirname}/src/common/views/`];

rollup({
  entry: 'main.js',
  plugins: [
    // Required by use of `partialRoot` below.
    rootImport({
      root: partialRoots,
    }),
    handlebars({
      handlebars: {
        // The module ID of the Handlebars runtime, exporting `Handlebars` as `default`.
        // As a shortcut, you can pass this as the value of `handlebars` above.
        // See the "Handlebars" section below.
        id: 'handlebars', // Default: the path of Handlebars' CJS definition within this module

        // Custom handlebars compiler if the built in version is not proper. If you pass this,
        // you must also pass `id` (above), to ensure that the compiler and runtime versions match.
        module: require('handlebars'),

        // Options to pass to Handlebars' `parse` and `precompile` methods.
        options: {
          // Whether to generate sourcemaps for the templates
          sourceMap: true, // Default: true
        },
      },

      // The ID(s) of modules to import before every template, see the "Helpers" section below.
      // Can be a string too.
      helpers: ['/utils/HandlebarsHelpers.js'], // Default: none

      // In case you want to compile files with other extensions.
      templateExtension: '.html', // Default: '.hbs'

      // A function that can determine whether or not a template is a partial.
      isPartial: (name) => name.startsWith('_'), // Default: as at left

      // The absolute paths of the root directory(ies) from which to try to resolve the partials.
      // You must also register these with `rollup-plugin-root-import`.
      partialRoot: partialRoots, // Default: none

      // The module ID of jQuery, see the "jQuery" section below.
      jquery: 'jquery', // Default: none
    }),
  ],
});
```

lets you do this:

```hbs
{{! src/client/js/views/_messageBody.html }}
<p>{{message}}</p>
```

```hbs
{{! src/client/js/views/message.html }}
<div>{{> _messageBody }}</div>
```

```js
// main.js
import $ from 'jquery';
import MessageTemplate from 'message.html';

$('body').append(MessageTemplate({ message: 'Hello world!' }));
```

### Helpers

You can load Handlebars helpers using the `helpers` option, whose value is the ID(s) of modules to
import before every template. They should export as `default` a function that accepts the Handlebars
runtime as argument, letting them register helpers. Each such export will only be invoked once.

```js
import { rollup } from 'rollup';
import { handlebars } from 'rollup-plugin-handlebars-plus';

rollup({
  entry: 'main.js',
  plugins: [
    handlebars({
      helpers: ['/utils/HandlebarsHelpers.js'],
    }),
  ],
});
```

```js
// /utils/HandlebarsHelpers.js
export default function (Handlebars) {
  Handlebars.registerHelper('encodeURIComponent', function (text) {
    return new Handlebars.SafeString(encodeURIComponent(text));
  });
}
```

```hbs
{{! dashboardLink.hbs }}
<a href="https://app.mixmax.com/dashboard/live?user={{encodeURIComponent email}}">Dashboard</a>
```

```js
// main.js
import DashboardLinkTemplate from './dashboardLink.hbs';

console.log(DashboardLinkTemplate({ email: 'jeff@mixmax.com' }));
```

### Handlebars

This plugin produces [precompiled](http://handlebarsjs.com/precompilation.html) templates, which
then need to be rendered by the Handlebars runtime. You can either bundle the runtime yourself
and provide its module ID to this plugin using the `handlebars.id` option, or you can let the
plugin bundle its own copy of the runtime.

The advantage of the latter is that compatibility is
guaranteed between the compiler and the runtime (see #6
[here](https://github.com/wycats/handlebars.js/blob/8517352e209569f5a373d7a61ef4a673582d9616/FAQ.md)).

The tradeoff is that the plugin's copy of the runtime is a CJS module, so to load such you'll also
need to install `rollup-plugin-node-resolve` and `rollup-plugin-commonjs`:

```js
import { rollup } from 'rollup';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { handlebars } from 'rollup-plugin-handlebars-plus';

rollup({
  entry: 'main.js',
  plugins: [
    resolve(),
    commonjs({
      include: 'node_modules/**',
    }),
    handlebars(),
  ],
});
```

In case you need the default runtime ID, it's available as `handlebars.runtimeId`. This might be
useful if you want to import the runtime for use by templates precompiled by something other than
this plugin. In that case, you'll have to make sure that the other compiler's version is compatible
with this runtime.

### jQuery

At Mixmax we often find it convenient to render templates to [jQuery](https://jquery.com/) collections
rather than to raw strings. This lets us immediately manipulate the template as a DOM element, either
by passing it to an API that expects such like
[Backbone.View#setElement](http://backbonejs.org/#View-setElement):

```js
import Backbone from 'backbone';
import Template from './index.html';

const MyView = Backbone.View.extend({
  render() {
    this.setElement(Template());
  },
});
```

or by customizing the template using jQuery's APIs:

```js
import $ from 'jquery';
import TooltipTemplate from './popdown.html';

const tooltip = TooltipTemplate();

tooltip.css({
  left: 50,
  top: 100,
});

$('body').append(tooltip);
```

What makes this possible is providing the module ID of jQuery (that you've bundled separately) to
this plugin, using the `jquery` option:

```js
import { rollup } from 'rollup';
import { handlebars } from 'rollup-plugin-handlebars-plus';

rollup({
  entry: 'main.js',
  plugins: [
    handlebars({
      jquery: 'jquery',
    }),
  ],
});
```

Curious about how to ID jQuery when it's a global i.e. you're _not_ bundling it?
[Here's a Gist for that.](https://gist.github.com/wearhere/a3684edd54787b698029e42ea6ccc0f3)

In case you want to render to a string even when using this option, all precompiled template
functions support an additional `format` option so you can do:

```js
import Template from './index.html';

console.log(Template({}, { format: 'string' }));
```

### Fragments and Elements

It can also be helpful to render a template to a `DocumentFragment`, which is supported by the
`format` option:

```js
import Template from './index.html';

document.body.append(Template({}, { format: 'fragment' }));
```

Or to take the first element from that fragment:

```js
import Template from './index.html';

document.body.append(Template({}, { format: 'element' }));
```

### Babel Helpers

If you use `@babel/runtime` elsewhere in your project and have it as a dependency, you can benefit
by passing `babelHelpers: 'runtime'` in the `options`, which will have the internal babel transforms
for generated code use the common helpers. This does not apply if you don't use any of the non-
string formats (i.e. only use handlebars to produce strings). Use the `babelRuntime` option to pass
options to `@babel/plugin-transform-runtime`.

## Contributing

We welcome pull requests! Please lint your code using the JSHint configuration in this project.

## Credits

Created by [Eli Skeggs](https://eliskeggs.com) and [Jeff Wear](https://twitter.com/wear_here).

Prior art: https://github.com/jibhaine/rollup-plugin-handlebars.

### How does this differ from `rollup-plugin-handlebars`?

At the time of this project's development, `rollup-plugin-handlebars` did not support partials.
This project was created to fix that and to add support for a few other features that Mixmax
needed to be compatible with our use of Handlebars template pre-Rollup. We
[started](https://github.com/jibhaine/rollup-plugin-handlebars/pull/3) to add partial support to
`rollup-plugin-handlebars`, then got blocked and made a solution (this plugin) that was specific
to our needs, then worked to make this more generic again (we think). We kept this as a separate
project since the code had become by that point very different.
