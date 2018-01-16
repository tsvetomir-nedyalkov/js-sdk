'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

(function () {

  function uid() {
    var size = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;

    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < size; i += 1) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
  }

  function randomString() {
    var size = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 18;
    var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

    return '' + prefix + uid(size);
  }

  function randomEmailAddress() {
    return randomString() + '@test.com';
  }

  function getEntity(_id, textValue, numberValue, array) {
    var _entity;

    var entity = (_entity = {}, _defineProperty(_entity, Constants.TextFieldName, textValue || randomString()), _defineProperty(_entity, Constants.NumberFieldName, numberValue || numberValue === 0 ? numberValue : Math.random()), _defineProperty(_entity, Constants.ArrayFieldName, array || [randomString(), randomString()]), _entity);

    if (_id) {
      entity._id = _id;
    }
    return entity;
  }

  //saves an array of entities and returns the result sorted by _id for an easier usage in 'find with modifiers' tests
  function saveEntities(collectionName, entities) {
    var networkStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Network);
    var syncStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
    return Promise.all(entities.map(function (entity) {
      return networkStore.save(entity);
    })).then(function () {
      return syncStore.pull();
    }).then(function (result) {
      return _.sortBy(deleteEntityMetadata(result), '_id');
    });
  }

  function deleteUsers(userIds) {
    return Promise.all(userIds.map(function (userId) {
      return Kinvey.User.remove(userId, {
        hard: true
      });
    }));
  }

  function ensureArray(entities) {
    return [].concat(entities);
  }

  function assertEntityMetadata(entities) {
    ensureArray(entities).forEach(function (entity) {
      expect(entity._kmd.lmt).to.exist;
      expect(entity._kmd.ect).to.exist;
      expect(entity._acl.creator).to.exist;
    });
  }

  function deleteEntityMetadata(entities) {
    ensureArray(entities).forEach(function (entity) {
      delete entity['_kmd'];
      delete entity['_acl'];
    });
    return entities;
  }

  //validates the result of a find() or a count() operation according to the DataStore type with an optional sorting
  //works with a single entity, an array of entities or with numbers
  function validateReadResult(dataStoreType, spy, cacheExpectedEntities, backendExpectedEntities, sortBeforeCompare) {
    var firstCallArgs = spy.firstCall.args[0];
    var secondCallArgs = void 0;
    if (dataStoreType === Kinvey.DataStoreType.Cache) {
      secondCallArgs = spy.secondCall.args[0];
    }

    var isComparingEntities = !_.isNumber(cacheExpectedEntities);
    var isSavedEntity = _.first(ensureArray(cacheExpectedEntities)).hasOwnProperty('_id');
    var shouldPrepareForComparison = isComparingEntities && isSavedEntity;

    // if we have entities, which have an _id field, we remove the metadata in order to compare properly and sort by _id if needed
    if (shouldPrepareForComparison) {
      deleteEntityMetadata(firstCallArgs);
      if (sortBeforeCompare) {
        firstCallArgs = _.sortBy(firstCallArgs, '_id');
        cacheExpectedEntities = _.sortBy(cacheExpectedEntities, '_id');
        backendExpectedEntities = _.sortBy(backendExpectedEntities, '_id');
      }
      if (secondCallArgs) {
        deleteEntityMetadata(secondCallArgs);
        if (sortBeforeCompare) {
          secondCallArgs = _.sortBy(secondCallArgs, '_id');
        }
      }
    }

    //the actual comparison, according to the Data Store type 
    if (dataStoreType === Kinvey.DataStoreType.Network) {
      expect(spy.calledOnce).to.be.true;
      expect(firstCallArgs).to.deep.equal(backendExpectedEntities);
    } else if (dataStoreType === Kinvey.DataStoreType.Sync) {
      expect(spy.calledOnce).to.be.true;
      expect(firstCallArgs).to.deep.equal(cacheExpectedEntities);
    } else {
      expect(spy.calledTwice).to.be.true;
      expect(firstCallArgs).to.deep.equal(cacheExpectedEntities);
      expect(secondCallArgs).to.deep.equal(backendExpectedEntities);
    }
  }

  function retrieveEntity(collectionName, dataStoreType, entity, searchField) {

    var store = Kinvey.DataStore.collection(collectionName, dataStoreType);
    var query = new Kinvey.Query();
    var propertyToSearchBy = searchField || '_id';
    query.equalTo(propertyToSearchBy, entity[propertyToSearchBy]);
    return store.find(query).toPromise().then(function (result) {
      return result[0];
    });
  }

  function validatePendingSyncCount(dataStoreType, collectionName, itemsForSyncCount) {
    if (dataStoreType !== Kinvey.DataStoreType.Network) {
      return new Promise(function (resolve, reject) {
        var expectedCount = 0;
        if (dataStoreType === Kinvey.DataStoreType.Sync) {
          expectedCount = itemsForSyncCount;
        }
        var store = Kinvey.DataStore.collection(collectionName, dataStoreType);
        return store.pendingSyncCount().then(function (syncCount) {
          expect(syncCount).to.equal(expectedCount);
          resolve();
        }).catch(reject);
      });
    }
  }

  function validateEntity(dataStoreType, collectionName, expectedEntity, searchField) {
    var entityFromCache = void 0;
    var entityFromBackend = void 0;

    return retrieveEntity(collectionName, Kinvey.DataStoreType.Sync, expectedEntity, searchField).then(function (result) {
      if (result) {
        entityFromCache = deleteEntityMetadata(result);
      }
      return retrieveEntity(collectionName, Kinvey.DataStoreType.Network, expectedEntity, searchField);
    }).then(function (result) {
      if (result) {
        entityFromBackend = deleteEntityMetadata(result);
      }
      if (dataStoreType === Kinvey.DataStoreType.Network) {
        expect(entityFromCache).to.be.undefined;
        expect(entityFromBackend).to.deep.equal(expectedEntity);
      } else if (dataStoreType === Kinvey.DataStoreType.Sync) {
        expect(entityFromCache).to.deep.equal(expectedEntity);
        expect(entityFromBackend).to.be.undefined;
      } else {
        expect(entityFromCache).to.deep.equal(expectedEntity);
        expect(entityFromBackend).to.deep.equal(expectedEntity);
      }
    });
  }

  function cleanUpCollectionData(collectionName) {
    var networkStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Network);
    var syncStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
    return networkStore.find().toPromise().then(function (entities) {
      if (entities && entities.length > 0) {
        var query = new Kinvey.Query();
        query.contains('_id', entities.map(function (a) {
          return a._id;
        }));
        return networkStore.remove(query);
      }
    }).then(function () {
      return syncStore.clearSync();
    }).then(function () {
      return syncStore.clear();
    });
  }

  function cleanUpAppData(collectionName, createdUserIds) {
    return Kinvey.User.logout().then(function () {
      return Kinvey.User.signup();
    }).then(function (user) {
      createdUserIds.push(user.data._id);
      return cleanUpCollectionData(collectionName);
    }).then(function () {
      return deleteUsers(createdUserIds);
    }).then(function () {
      createdUserIds.length = 0;
      return Kinvey.User.logout();
    });
  }

  var utilities = {
    uid: uid,
    randomString: randomString,
    randomEmailAddress: randomEmailAddress,
    getEntity: getEntity,
    saveEntities: saveEntities,
    deleteUsers: deleteUsers,
    ensureArray: ensureArray,
    assertEntityMetadata: assertEntityMetadata,
    deleteEntityMetadata: deleteEntityMetadata,
    validateReadResult: validateReadResult,
    retrieveEntity: retrieveEntity,
    validatePendingSyncCount: validatePendingSyncCount,
    validateEntity: validateEntity,
    cleanUpCollectionData: cleanUpCollectionData,
    cleanUpAppData: cleanUpAppData
  };

  if ((typeof module === 'undefined' ? 'undefined' : _typeof(module)) === 'object') {
    module.exports = utilities;
  } else {
    window.utilities = utilities;
  }
})();