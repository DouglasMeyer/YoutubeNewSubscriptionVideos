"use strict";
var ModelJS = function(setupFn) {
  var Model = function(attrs) {
    if (setupFn) {
      setupFn.call(Model);
      setupFn = undefined;
    }
    var name;
    for (name in attrs) {
      this[name] = attrs[name];
    }
  };
  Object.defineProperties(Model, ModelJS.NewModelProperties);
  Object.defineProperties(Model.prototype, ModelJS.NewModelPrototypeProperties);
  return Model;
};
ModelJS.NewModelProperties = {};
ModelJS.NewModelPrototypeProperties = {};
ModelJS.NewModelProperties['associations'] = {get: function() {
    return this._associations || (this._associations = {});
  }};
var HasManyAssociation = function(key, model) {
  var options = arguments[2] !== (void 0) ? arguments[2] : {};
  this.key = key;
  this.model = model;
  this.inverse = options.inverse;
};
HasManyAssociation.prototype.associate = function(item, owner) {
  var index = owner[this.key].indexOf(item);
  if (index == -1)
    owner[this.key].push(item);
};
HasManyAssociation.prototype.disassociate = function(item, owner) {
  var index = owner[this.key].indexOf(item);
  if (index != -1)
    owner[this.key].splice(index, 1);
};
var BelongsToAssociation = function(key, model) {
  var options = arguments[2] !== (void 0) ? arguments[2] : {};
  this.key = key;
  this.model = model;
  this.inverse = options.inverse;
};
BelongsToAssociation.prototype.associate = function(item, owner) {
  owner[this.key] = item;
};
BelongsToAssociation.prototype.disassociate = function(item, owner) {
  owner[this.key] = null;
};
ModelJS.NewModelProperties['hasMany'] = {value: function(key, model) {
    var options = arguments[2] !== (void 0) ? arguments[2] : {};
    var pKey = '_' + key;
    this.associations[key] = new HasManyAssociation(key, model, options);
    Object.defineProperty(this.prototype, pKey, {
      configurable: true,
      writable: true
    });
    Object.defineProperty(this.prototype, key, {
      get: function() {
        if (!this[pKey])
          this[pKey] = [];
        return this[pKey];
      },
      set: function(vals) {
        var $__0 = this;
        vals = vals.map((function(val) {
          return val instanceof model ? val : new model(val);
        }));
        this[key].forEach((function(val) {
          if (vals.indexOf(val) == -1) {
            var index = $__0[key].indexOf(val);
            $__0[key].splice(index, 1);
            var inverseAssociation = val.constructor.associations[options.inverse];
            if (inverseAssociation)
              inverseAssociation.disassociate($__0, val);
          }
        }));
        vals.forEach((function(val) {
          if ($__0[pKey].indexOf(val) == -1) {
            $__0[pKey].push(val);
            var inverseAssociation = val.constructor.associations[options.inverse];
            if (inverseAssociation)
              inverseAssociation.associate($__0, val);
          }
        }));
        return this[key];
      }
    });
  }};
ModelJS.NewModelProperties['belongsTo'] = {value: function(key, model) {
    var options = arguments[2] !== (void 0) ? arguments[2] : {};
    var pKey = '_' + key;
    this.associations[key] = new BelongsToAssociation(key, model, options);
    Object.defineProperty(this.prototype, pKey, {
      configurable: true,
      writable: true
    });
    Object.defineProperty(this.prototype, key, {
      get: function() {
        return this[pKey];
      },
      set: function(val) {
        var oldVal = this[key];
        if (oldVal && oldVal !== val) {
          var inverseAssociation = oldVal.constructor.associations[options.inverse];
          if (inverseAssociation)
            inverseAssociation.disassociate(this, oldVal);
        }
        this[pKey] = (val === null || val instanceof model) ? val : new model(val);
        if (this[pKey]) {
          var inverseAssociation = this[pKey].constructor.associations[options.inverse];
          if (inverseAssociation)
            inverseAssociation.associate(this, this[pKey]);
        }
        return this[pKey];
      }
    });
  }};
ModelJS.defaultMapper = function(Model, action, data, options) {};
ModelJS.NewModelProperties['find'] = {value: function(findOpts) {
    return ModelJS.defaultMapper(this, 'find', findOpts);
  }};
ModelJS.NewModelPrototypeProperties['save'] = {value: function(saveOpts) {
    return ModelJS.defaultMapper(this.constructor, 'save', this, saveOpts);
  }};
ModelJS.NewModelPrototypeProperties['destroy'] = {value: function(destroyOpts) {
    return ModelJS.defaultMapper(this.constructor, 'destroy', this, destroyOpts);
  }};
var global;
if (typeof module !== 'undefined') {
  module.exports = ModelJS;
} else {
  window.ModelJS = ModelJS;
}
//# sourceURL=model_js.js
//# sourceMappingURL=model_js.js.map