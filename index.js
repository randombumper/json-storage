/**
 * Creates an storage item instance
 *
 * @param {JsonStorage} storage Storage reference
 * @param {string} key Key inside the storage
 */
const JsonStorageKey = (storage, key) => {

  if(key.indexOf('|') != -1) {
    throw 'JsonStorage: Storage keys cannot contain pipe characters (|)'
  }

  this.storage        = storage
  this.key            = key
  this.nativeStorage  = window[storage.engine]

  this.getFullKey = key => '__jsonStorage|' + storage.name + '|' + storage.key;

  this.rawReplace = newValue => {
    instance.nativeStorage.setItem(
      instance.getFullKey(instance.key), newValue
    )
  }

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
      instance.nativeStorage.setItem(
        instance.getFullKey(instance.key), newValue
      )

      // Propagate if connected storage
      if(instance.storage.connected) {
        localStorage.setItem(
          '__jsonStorageValue|' + storage.name + '|' + instance.key,
          newValue
        )
        localStorage.removeItem(
          '__jsonStorageValue|' + storage.name + '|' + instance.key
        )
      }
    },

    rawReplace: instance.rawReplace

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

  if(JsonStorage.instances.indexOf(name) != -1) {
    console.warn(`JsonStorage: Storage with name ${name} already exists. Did you want to retrieve it, rather than create it?`)
  }

  if(name.indexOf('|') != -1) {
    throw 'JsonStorage: Storage names cannot contain pipe characters (|)'
  }

  /** Storage name, for late retrieval */
  this.name = name;

  /** localStorage (default) or sessionStorage */
  this.engine = !!options.session
                  ? 'sessionStorage'
                  : 'localStorage';

  /** Connected (share across tabs). For sessionStorage only */
  this.connected = this.engine == 'sessionStorage' && options.connected
  if(this.connected) {
    JsonStorage.connect()
    this.request()
  }

  this.getKey = key => JsonStorageKey(this, key)

  this.getVal = key => this.getKey(key).val

  this.request = () => {
    localStorage.setItem('__jsonStorageRequest|' + this.name, 1)
    localStorage.removeItem('__jsonStorageRequest|' + this.name)
  }

  // Instance reference
  const instance = this

  // Exported interface
  const output = {

    get name()  { return instance.name },
    set name(x) { throw 'JsonStorage: Storage name is read-only' },

    get engine()  { return instance.engine },
    set engine(x) { throw 'JsonStorage: Storage engine is read-only' },

    get connected()  { return instance.connected },
    set connected(x) { throw 'JsonStorage: Storage connected property is read-only' },

    key: instance.getKey,

    get: instance.getVal

  }

  JsonStorage.register(name, output);
  return output;
}

JsonStorage.instances = JsonStorage.instances || []

JsonStorage.register = function(name, storage) {
  JsonStorage.instances[name] = storage;
}

JsonStorage.retrieve = function(name) {
  return JsonStorage.instances[name];
}

JsonStorage.connect = () => { console.info("connecting")
  const transfer = event => { console.info(event)
    // MSIE
    event = event || window.event

    // Do nothing if nothing changed
    if(!event.newValue) {
      return;
    }

    if(/^__jsonStorageValue/.test(event.key)) {

      // A new value was sent from some other tab
      let [nothing, name, key] = event.key.split('|')
      JsonStorage.retrieve(name).key(key).rawReplace(event.newValue)

    } else if(/^__jsonStorageRequest/.test(event.key)) {

      // Some other tab requested a whole storage

    } else if(/^__jsonStorageTransfer/.test(event.key)) {

      // Some other tab sent a whole storage

    }
  }

  // Listen for changes to localStorage
  window.addEventListener
    ? window.addEventListener('storage', transfer, false)
    : window.attachEvent('onstorage', transfer);
}

module.exports = JsonStorage;