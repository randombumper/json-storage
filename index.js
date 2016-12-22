/** Store all registered instances */
const jsonStorageInstances = [];


/**
 * Creates an storage item instance
 *
 * @param {JsonStorage} storage Storage reference
 * @param {string} key Key inside the storage
 */
const JsonStorageKey = (storage, key) => {

  this.storage        = storage
  this.key            = key
  this.nativeStorage  = window[storage.engine]

  this.getFullKey = key => '__jsonStorage_' + storage.name + '_' + storage.key;

  // Instance reference
  let instance = this

  // Exported interface
  const output = {

    get val() {
      return JSON.parse(
        instance.nativeStorage.getItem(
          instance.getFullKey(instance.key)
        )
      )
    },
    set val(newValue) {
      try {
        newValue = JSON.stringify(newValue)
      } catch(exception) {
        throw 'JsonStorage: Value is not serializable'
      }
      return instance.nativeStorage.setItem(
        instance.getFullKey(instance.key), newValue
      )
    }

  }

  return output

}


/**
 * Creates an storage instance
 *
 * @param {string} name Storage name, for later retrieval
 */
const JsonStorage = (name, options = {}) => {

  if(!name) {
    throw 'JsonStorage: Storage needs a name'
  }

  if(jsonStorageInstances.indexOf(name) != -1) {
    console.warn(`JsonStorage: Storage with name ${name} already exists. Did you want to retrieve it, rather than create it?`)
  }

  /** Storage name, for late retrieval */
  this.name = name;

  /** localStorage (default) or sessionStorage */
  this.engine = !!options.session
                  ? 'sessionStorage'
                  : 'localStorage';

  this.getKey = key => JsonStorageKey(this, key)

  this.getVal = key => this.getKey(key).val

  // Instance reference
  const instance = this

  // Exported interface
  const output = {

    get name()  { return instance.name },
    set name(x) { throw 'JsonStorage: Storage name is read-only' },

    get engine()  { return instance.engine },
    set engine(x) { throw 'JsonStorage: Storage engine is read-only' },

    key: instance.getKey,

    get: instance.getVal

  }

  JsonStorage.register(name, output);
  return output;
}

JsonStorage.register = function(name, storage) {
  jsonStorageInstances[name] = storage;
}

JsonStorage.retrieve = function(name) {
  return jsonStorageInstances[name];
}

module.exports = JsonStorage;