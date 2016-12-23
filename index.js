'use strict';

if(typeof window == 'undefined') {

  // Not in browser, export null function
  module.exports = () => {}

} else {

  /**
   * Creates an storage item instance
   *
   * @param {JsonStorage} storage Storage reference
   * @param {string} key Key inside the storage
   */
  const JsonStorageKey = (storage, key) => {

    // Private reference
    const pvt = {}

    if(key.indexOf('|') != -1) {
      throw 'JsonStorage: Storage keys cannot contain pipe characters (|)'
    }

    pvt.storage        = storage
    pvt.key            = key
    pvt.nativeStorage  = window[storage.engine]

    pvt.getFullKey = key =>
      '__jsonStorage|' + storage.name + '|' + pvt.key;

    pvt.rawReplace = newValue => {
      pvt.nativeStorage.setItem(
        pvt.getFullKey(pvt.key), newValue
      )
    }

    pvt.remove = bypassConnect => {
      pvt.nativeStorage.removeItem(
        pvt.getFullKey(pvt.key)
      )

      // Propagate if connected storage
      if(pvt.storage.connected && !bypassConnect) {
        localStorage.setItem(
          '__jsonStorageValue|' + pvt.storage.name + '|' + pvt.key,
          '__jsonStorageRemove'
        )
        localStorage.removeItem(
          '__jsonStorageValue|' + pvt.storage.name + '|' + pvt.key
        )
      }
    }

    pvt.receiveValue = newValue => {
      if(newValue == '__jsonStorageRemove') {
        pvt.remove(true)
      } else {
        pvt.rawReplace(event.newValue)
      }
    }

    // Exported interface
    const pub = {

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

    return pub

  }


  /**
   * Creates an storage instance
   *
   * @param {string} name Storage name, for later retrieval
   */
  const JsonStorage = (name, options = {}) => {

    // Private reference
    const pvt = {}

    if(!name) {
      throw 'JsonStorage: Storage needs a name'
    }

    if(name.indexOf('|') != -1) {
      throw 'JsonStorage: Storage names cannot contain pipe characters (|)'
    }

    /** Storage name, for late retrieval */
    pvt.name = name

    pvt.options = options

    /** localStorage (default) or sessionStorage */
    pvt.engine = !!options.session
                    ? 'sessionStorage'
                    : 'localStorage';

    pvt.nativeStorage = window[pvt.engine]

    pvt.request = () => {
      pvt.storageRequested = true
      localStorage.setItem('__jsonStorageRequest|' + pvt.name, 1)
      localStorage.removeItem('__jsonStorageRequest|' + pvt.name)
    }

    pvt.keys = full => {
      const keyPattern = new RegExp('^__jsonStorage\\|' + pvt.name + '\\|'),
            keyArray = []

      // Iterate native storage and populate result object
      for(let i = 0; i < pvt.nativeStorage.length; i++) {
        let key = pvt.nativeStorage.key(i)
        if(keyPattern.test(key)) {
          keyArray.push(full ? key : key.split('|')[2])
        }
      }

      return keyArray
    }

    /** Connected (share across tabs). For sessionStorage only */
    pvt.connected = pvt.engine == 'sessionStorage' && options.connected
    if(pvt.connected) {
      JsonStorage.connect()
      if(pvt.keys().length == 0) {
        pvt.request()
      }
    }

    pvt.getKey = key => JsonStorageKey(pvt, key)

    pvt.export = full => {
      const exportObject = {}

      pvt.keys(full).forEach(key => {
        exportObject[key] = full
          ? pvt.nativeStorage.getItem(key)
          : pvt.getKey(key).val
      })

      return exportObject
    }

    pvt.clear = bypassConnect => {
      if(bypassConnect) {
        pvt.keys(true).forEach(fullKey => pvt.nativeStorage.removeItem(fullKey))
      } else {
        pvt.keys().forEach(key => pvt.getKey(key).remove())
      }
      pvt.keys()
    }

    pvt.sendStorage = () => {
      if(!pvt.connected) {
        throw 'JsonStorage: Cannot send unconnected storage'
      }

      // Push fullStorage
      localStorage.setItem(
        '__jsonStorageResponse|' + pvt.name,
        JsonStorage.stringify(pvt.export(true))
      )
      localStorage.removeItem('__jsonStorageResponse|' + pvt.name)

    },

    pvt.receiveStorage = receivedStorage => {
      // Ignore if the storage wasn't requested
      if(!pvt.storageRequested) {
        return
      }

      // Unset flag
      pvt.storageRequested = false

      // Clear storage
      pvt.clear(true)

      // Repopulate storage
      receivedStorage = JsonStorage.parse(receivedStorage)
      Object.keys(receivedStorage).forEach(key => {
        sessionStorage.setItem(key, receivedStorage[key])
      })

      // Run event handlers
      pvt.eventHandlers.receiveStorage &&
        pvt.eventHandlers.receiveStorage.forEach(
          handler => handler()
        )

    }

    pvt.eventHandlers = JsonStorage.eventHandlers || {}
    pvt.on = (event, handler) => {
      if(pvt.eventHandlers[event]) {
        pvt.eventHandlers[event].push(handler)
      } else {
        pvt.eventHandlers[event] = [handler]
      }
    }


    // Exported interface
    const pub = {

      get name()  { return pvt.name },
      set name(x) { throw 'JsonStorage: Storage name is read-only' },

      get engine()  { return pvt.engine },
      set engine(x) { throw 'JsonStorage: Storage engine is read-only' },

      get connected()  { return pvt.connected },
      set connected(x) { throw 'JsonStorage: Storage connected property is read-only' },

      key: pvt.getKey,

      get:    key => pvt.getKey(key).val,
      set:    (key, val) => pvt.getKey(key).val = val,
      remove: key => pvt.getKey(key).remove(),

      sendStorage:    pvt.sendStorage,
      receiveStorage: pvt.receiveStorage,
      keys:           pvt.keys.bind(this, false),
      export:         pvt.export.bind(this,false),
      length:         pvt.length,
      clear:          pvt.clear.bind(this, false),

      on: pvt.on

    }

    Object.defineProperty(pub, 'length', {
      get: function length() {
        return pvt.keys().length
      },
      set: function length(newValue) {
        throw ('JsonStorage: Storage length is read-only')
      }
    })

    JsonStorage.register(name, pub);
    return pub;
  }

  JsonStorage.parse = json => {
    return json == 'undefined'
      ? undefined
      : JSON.parse(json)
  }

  JsonStorage.stringify = JSON.stringify

  JsonStorage.instances = JsonStorage.instances || {}
  JsonStorage.promises  = JsonStorage.promises  || {}
  JsonStorage.resolvers = JsonStorage.resolvers || {}

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

}