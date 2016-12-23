'use strict';

/**
 * Creates an storage item instance
 *
 * @param {JsonStorage} storage Storage reference
 * @param {string} key Key inside the storage
 */
const JsonStorageKey = (storage, key) => {

  // Private reference
  const pvt = this

  if(key.indexOf('|') != -1) {
    throw 'JsonStorage: Storage keys cannot contain pipe characters (|)'
  }

  this.storage        = storage
  this.key            = key
  this.nativeStorage  = window[storage.engine]

  this.getFullKey = key =>
    '__jsonStorage|' + storage.name + '|' + storage.key;

  this.rawReplace = newValue => {
    pvt.nativeStorage.setItem(
      pvt.getFullKey(pvt.key), newValue
    )
  }

  this.remove = bypassConnect => {
    this.nativeStorage.removeItem(
      this.getFullKey(this.key)
    )

    // Propagate if connected storage
    if(this.storage.connected && !bypassConnect) {
      localStorage.setItem(
        '__jsonStorageValue|' + this.storage.name + '|' + this.key,
        '__jsonStorageRemove'
      )
      localStorage.removeItem(
        '__jsonStorageValue|' + this.storage.name + '|' + this.key
      )
    }
  }

  this.receiveValue = newValue => {
    if(newValue == '__jsonStorageRemove') {
      this.remove(true)
    } else {
      this.rawReplace(event.newValue)
    }
  }

  // Exported interface
  const output = {

    get val() {
      return JsonStorage.parse(
        pvt.nativeStorage.getItem(
          pvt.getFullKey(pvt.key)
        )
      )
    },
    set val(newValue) {
      try {
        newValue = JsonStorage.stringify(newValue)
      } catch(exception) {
        throw 'JsonStorage: Value is not serializable'
      }
      pvt.nativeStorage.setItem(
        pvt.getFullKey(pvt.key), newValue
      )

      // Propagate if connected storage
      if(pvt.storage.connected) {
        localStorage.setItem(
          '__jsonStorageValue|' + storage.name + '|' + pvt.key,
          newValue
        )
        localStorage.removeItem(
          '__jsonStorageValue|' + storage.name + '|' + pvt.key
        )
      }
    },

    remove: pvt.remove.bind(this, false),

    receiveValue: pvt.receiveValue

  }

  return output

}


/**
 * Creates an storage instance
 *
 * @param {string} name Storage name, for later retrieval
 */
const JsonStorage = (name, options = {}) => {

  // Private reference
  const pvt = this

  if(!name) {
    throw 'JsonStorage: Storage needs a name'
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

  this.nativeStorage = window[this.engine]

  this.request = () => {
    this.storageRequested = true
    localStorage.setItem('__jsonStorageRequest|' + this.name, 1)
    localStorage.removeItem('__jsonStorageRequest|' + this.name)
  }

  this.keys = full => {
    const keyPattern = new RegExp('^__jsonStorage\\|' + this.name + '\\|'),
          keyArray = []

    // Iterate sessionStorage and populate result object
    for(let i = 0; i < sessionStorage.length; i++) {
      let key = sessionStorage.key(i)
      if(keyPattern.test(key)) {
        keyArray.push(full ? key : key.split('|')[2])
      }
    }

    return keyArray
  }

  /** Connected (share across tabs). For sessionStorage only */
  this.connected = this.engine == 'sessionStorage' && options.connected
  if(this.connected) {
    JsonStorage.connect()
    if(this.keys().length == 0) {
      this.request()
    }
  }

  this.getKey = key => JsonStorageKey(this, key)

  this.export = full => {
    const exportObject = {}

    this.keys(full).forEach(key => {
      exportObject[key] = full
        ? this.nativeStorage.getItem(key)
        : this.getKey(key).val
    })

    return exportObject
  }

  this.clear = bypassConnect => {
    if(bypassConnect) {
      this.keys(true).forEach(fullKey => this.nativeStorage.removeItem(fullKey))
    } else {
      this.keys().forEach(key => this.getKey(key).remove())
    }
    this.keys()
  }

  this.sendStorage = () => {
    if(!this.connected) {
      throw 'JsonStorage: Cannot send unconnected storage'
    }

    // Push fullStorage
    localStorage.setItem(
      '__jsonStorageResponse|' + this.name,
      JsonStorage.stringify(this.export(true))
    )
    localStorage.removeItem('__jsonStorageResponse|' + this.name)

  },

  this.receiveStorage = receivedStorage => {
    // Ignore if the storage wasn't requested
    if(!this.storageRequested) {
      return
    }

    // Unset flag
    this.storageRequested = false

    // Clear storage
    this.clear(true)

    // Repopulate storage
    receivedStorage = JsonStorage.parse(receivedStorage)
    Object.keys(receivedStorage).forEach(key => {
      sessionStorage.setItem(key, receivedStorage[key])
    })

  }

  // Exported interface
  const output = {

    get name()  { return pvt.name },
    set name(x) { throw 'JsonStorage: Storage name is read-only' },

    get engine()  { return pvt.engine },
    set engine(x) { throw 'JsonStorage: Storage engine is read-only' },

    get connected()  { return pvt.connected },
    set connected(x) { throw 'JsonStorage: Storage connected property is read-only' },

    key: pvt.getKey,

    get: key => pvt.getKey(key).val,

    set: (key, val) => pvt.getKey(key).val = val,

    remove: key => pvt.getKey(key).remove(),

    sendStorage: pvt.sendStorage,

    receiveStorage: pvt.receiveStorage,

    keys: pvt.keys.bind(this, false),

    export: pvt.export.bind(this,false),

    length: pvt.length,

    clear: pvt.clear.bind(this, false)

  }

  Object.defineProperty(output, 'length', {
    get: function length() {
      return pvt.keys().length
    },
    set: function length(newValue) {
      throw ('JsonStorage: Storage length is read-only')
    }
  })

  JsonStorage.register(name, output);
  return output;
}

JsonStorage.instances = JsonStorage.instances || {}

JsonStorage.promises  = JsonStorage.promises  || {}

JsonStorage.resolvers = JsonStorage.resolvers || {}

JsonStorage.parse = json => {
  return json == 'undefined'
    ? undefined
    : JSON.parse(json)
}

JsonStorage.stringify = JSON.stringify

JsonStorage.register = function(name, storage) {
  JsonStorage.instances[name] = storage;

  // Resolve promise, if any
  if(JsonStorage.resolvers[name]) {
    JsonStorage.resolvers[name](storage)
  }
}

JsonStorage.retrieve = function(name) {
  if(!JsonStorage.instances[name]) {
    throw `JsonStorage: Storage '${name}' does not exist`
  }

  return JsonStorage.instances[name];
}

JsonStorage.when = function(name) {
  if(!JsonStorage.promises[name]) {
    JsonStorage.promises[name] = new Promise((resolve, reject) => {
      JsonStorage.resolvers[name] = resolve
    })
  }

  return JsonStorage.promises[name]
}

JsonStorage.connect = () => {
  // Do nothing if already connected
  if(JsonStorage.connected) {
    return
  }

  const transfer = event => {
    // MSIE
    event = event || window.event

    // Do nothing if unsetting value
    if(!event.newValue) {
      return
    }

    if(/^__jsonStorageValue/.test(event.key)) {

      // A new value was sent from some other tab
      let [nothing, name, key] = event.key.split('|')
      JsonStorage.retrieve(name).key(key).receiveValue(event.newValue)

    } else if(/^__jsonStorageRequest/.test(event.key)) {

      // Some other tab requested a whole storage
      let [nothing, name] = event.key.split('|')
      JsonStorage.retrieve(name).sendStorage()

    } else if(/^__jsonStorageResponse/.test(event.key)) {

      // Some other tab sent a whole storage
      let [nothing, name] = event.key.split('|')
      JsonStorage.retrieve(name).receiveStorage(event.newValue)

    }
  }

  JsonStorage.connected = true

  // Listen for changes to localStorage
  window.addEventListener
    ? window.addEventListener('storage', transfer, false)
    : window.attachEvent('onstorage', transfer);
}

module.exports = JsonStorage;