'use strict';

export default (Handlebars) =>
  /**
   * Visit all the static partial-template imports, and collect them in an array.
   *
   * See API at https://github.com/wycats/handlebars.js/blob/master/docs/compiler-api.md.
   *
   * @constructor
   * @extends {Visitor}
   */
  class ImportScanner extends Handlebars.Visitor {
    constructor() {
      super();
      this.partials = [];
    }

    /**
     * Visit the partial statements, and collect their names.
     */
    PartialStatement(partial) {
      if (partial.name.type === 'SubExpression') {
        throw new Error('Dynamic partial resolution is not supported');
      }

      this.partials.push(partial.name.original);

      return super.PartialStatement(partial);
    }
  };
