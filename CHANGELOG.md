### [0.4.2](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/compare/v0.4.1...v0.4.2) (2020-09-09)


### Reverts

* Revert "chore: skip problematic dependabot commits" ([d904b23](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/commit/d904b2354592b945b853ddf27d6f40c6cb64955c))

### [0.4.1](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/compare/v0.4.0...v0.4.1) (2020-09-09)


### Bug Fixes

* **deps:** [security] bump handlebars from 4.3.0 to 4.6.0 ([#102](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/issues/102)) ([8469bbd](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/commit/8469bbd5dbdddb9bd92d58092b07a53df74f7baf))

## [0.4.0](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/compare/v0.3.0...v0.4.0) (2020-09-09)


### Features

* support pure helper definitions ([f38c9ea](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/commit/f38c9eab41476e8fead4107878b194f3239b53ff))

## [0.3.0](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/compare/v0.2.5...v0.3.0) (2020-09-09)


### Features

* mark generated Templates as pure ([e589ad2](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/commit/e589ad2de1d867e6106047ee5e0927d798524f54))

### [0.2.5](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/compare/v0.2.4...v0.2.5) (2019-11-15)


### Bug Fixes

* **opts:** check that options.handlebars is defined ([fcc1e8a](https://github.com/mixmaxhq/rollup-plugin-handlebars-plus/commit/fcc1e8ac42b322abae5f9e1422a765a2cdfec72c))

## Release History

- 0.2.4 Add extra config parameter to be able to define custom handlebars compiler

- 0.2.3 Don't override options.jquery if jQuery is global (@xcambar - #9)

- 0.2.2 Fix Windows compatibility (@mohd-akram - #8)

- 0.2.1 Use `var` in exported JS to improve compatibility

- 0.2.0 Expose default runtime ID as `handlebars.runtimeId`

- 0.1.1 Simplify runtime import

- 0.1.0 Initial release.
