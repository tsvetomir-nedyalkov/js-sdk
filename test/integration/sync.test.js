'use strict';

function testFunc() {

  var dataStoreTypes = [Kinvey.DataStoreType.Cache, Kinvey.DataStoreType.Sync];
  var networkStore = void 0;
  var syncStore = void 0;
  var cacheStore = void 0;
  var storeToTest = void 0;
  var notFoundErrorName = 'NotFoundError';
  var collectionName = externalConfig.collectionName;

  //validates Push operation result for 1 created, 1 modified and 1 deleted locally items
  var validatePushOperation = function validatePushOperation(result, createdItem, modifiedItem, deletedItem, expectedServerItemsCount) {
    expect(result.length).to.equal(3);
    result.forEach(function (record) {
      expect(record.operation).to.equal(record._id === deletedItem._id ? 'DELETE' : 'PUT');
      expect([createdItem._id, modifiedItem._id, deletedItem._id]).to.include(record._id);
      if (record.operation !== 'DELETE') {
        utilities.assertEntityMetadata(record.entity);
        utilities.deleteEntityMetadata(record.entity);
        expect(record.entity).to.deep.equal(record._id === createdItem._id ? createdItem : modifiedItem);
      } else {
        expect(record.entity).to.not.exist;
      }
    });
    networkStore.find().toPromise().then(function (result) {
      expect(result.length).to.equal(expectedServerItemsCount);
      expect(_.find(result, function (e) {
        return e._id === deletedItem._id;
      })).to.not.exist;
      expect(_.find(result, function (e) {
        return e.newProperty === modifiedItem.newProperty;
      })).to.exist;
      var createdOnServer = _.find(result, function (e) {
        return e._id === createdItem._id;
      });

      expect(utilities.deleteEntityMetadata(createdOnServer)).to.deep.equal(createdItem);
      return storeToTest.pendingSyncCount();
    }).then(function (count) {
      expect(count).to.equal(0);
    });
  };
  //validates Pull operation result
  var validatePullOperation = function validatePullOperation(result, expectedItems, expectedPulledItemsCount) {
    expect(result.length).to.equal(expectedPulledItemsCount || expectedItems.length);
    expectedItems.forEach(function (entity) {
      var resultEntity = _.find(result, function (e) {
        return e._id === entity._id;
      });
      expect(utilities.deleteEntityMetadata(resultEntity)).to.deep.equal(entity);
    });

    return syncStore.find().toPromise().then(function (result) {
      expectedItems.forEach(function (entity) {
        var cachedEntity = _.find(result, function (e) {
          return e._id === entity._id;
        });
        expect(utilities.deleteEntityMetadata(cachedEntity)).to.deep.equal(entity);
      });
    });
  };

  dataStoreTypes.forEach(function (currentDataStoreType) {
    describe(currentDataStoreType + ' Sync Tests', function () {

      var dataStoreType = currentDataStoreType;
      var entity1 = utilities.getEntity(utilities.randomString());
      var entity2 = utilities.getEntity(utilities.randomString());
      var entity3 = utilities.getEntity(utilities.randomString());
      var createdUserIds = [];

      before(function (done) {
        utilities.cleanUpAppData(collectionName, createdUserIds).then(function () {
          return Kinvey.User.signup();
        }).then(function (user) {
          createdUserIds.push(user.data._id);
          //store for setup
          networkStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Network);
          syncStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
          cacheStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Cache);
          //store to test
          storeToTest = Kinvey.DataStore.collection(collectionName, dataStoreType);
          done();
        }).catch(done);
      });

      after(function (done) {
        utilities.cleanUpAppData(collectionName, createdUserIds).then(function () {
          return done();
        }).catch(done);
      });

      describe('Pending sync queue operations', function () {

        beforeEach(function (done) {
          utilities.cleanUpCollectionData(collectionName).then(function () {
            return syncStore.save(entity1);
          }).then(function () {
            return syncStore.save(entity2);
          }).then(function () {
            return cacheStore.save(entity3);
          }).then(function () {
            return done();
          }).catch(done);
        });

        it('pendingSyncCount() should return the count of the entities waiting to be synced', function (done) {
          storeToTest.pendingSyncCount().then(function (count) {
            expect(count).to.equal(2);
            done();
          }).catch(done);
        });

        it('pendingSyncCount() should return the count of the entities, matching the query', function (done) {
          var query = new Kinvey.Query();
          query.equalTo('_id', entity1._id);
          storeToTest.pendingSyncCount(query).then(function (count) {
            expect(count).to.equal(1);
            done();
          }).catch(done);
        });

        it('clearSync() should clear the pending sync queue', function (done) {
          syncStore.clearSync().then(function () {
            return storeToTest.pendingSyncCount();
          }).then(function (count) {
            expect(count).to.equal(0);
            done();
          }).catch(done);
        });

        it('clearSync() should clear only the items, matching the query from the pending sync queue', function (done) {
          var query = new Kinvey.Query();
          query.equalTo('_id', entity1._id);
          syncStore.clearSync(query).then(function () {
            return storeToTest.pendingSyncEntities();
          }).then(function (result) {
            expect(result.length).to.equal(1);
            expect(result[0].entityId).to.equal(entity2._id);
            done();
          }).catch(done);
        });

        it('pendingSyncEntities() should return only the entities waiting to be synced', function (done) {
          storeToTest.pendingSyncEntities().then(function (entities) {
            expect(entities.length).to.equal(2);
            entities.forEach(function (entity) {
              expect(entity.collection).to.equal(externalConfig.collectionName);
              expect(entity.state.operation).to.equal('PUT');
              expect([entity1._id, entity2._id]).to.include(entity.entityId);
            });
            done();
          }).catch(done);
        });

        it('pendingSyncEntities() should return only the entities, matching the query', function (done) {
          var query = new Kinvey.Query();
          query.equalTo('_id', entity1._id);
          storeToTest.pendingSyncEntities(query).then(function (entities) {
            expect(entities.length).to.equal(1);
            expect(entities[0].entityId).to.equal(entity1._id);
            done();
          }).catch(done);
        });

        it('pendingSyncEntities() should return an empty array if there are no entities waiting to be synced', function (done) {
          syncStore.clearSync().then(function () {
            return storeToTest.pendingSyncEntities();
          }).then(function (entities) {
            expect(entities).to.be.an.empty.array;
            done();
          }).catch(done);
        });
      });

      describe('Sync operations', function () {

        var updatedEntity2 = void 0;

        beforeEach(function (done) {
          updatedEntity2 = _.assign({ newProperty: utilities.randomString() }, entity2);
          //adding three items, eligible for sync and one item, which should not be synced
          utilities.cleanUpCollectionData(collectionName).then(function () {
            return syncStore.save(entity1);
          }).then(function () {
            return cacheStore.save(entity2);
          }).then(function () {
            return cacheStore.save(entity3);
          }).then(function () {
            return syncStore.save(updatedEntity2);
          }).then(function () {
            return syncStore.removeById(entity3._id);
          }).then(function () {
            return cacheStore.save({});
          }).then(function () {
            return done();
          }).catch(done);
        });

        describe('push()', function () {

          it('should push created/updated/deleted locally entities to the backend', function (done) {
            storeToTest.push().then(function (result) {
              return validatePushOperation(result, entity1, updatedEntity2, entity3, 3);
            }).then(done).catch(done);
          });

          it('should push to the backend only the entities matching the query', function (done) {
            var query = new Kinvey.Query();
            query.equalTo('_id', entity1._id);
            storeToTest.push(query).then(function (result) {
              expect(result.length).to.equal(1);
              expect(result[0]._id).to.equal(entity1._id);

              return networkStore.find().toPromise().then(function (result) {
                expect(_.find(result, function (entity) {
                  return entity._id === entity1._id;
                })).to.exist;
                expect(_.find(result, function (entity) {
                  return entity._id === entity3._id;
                })).to.exist;
                done();
              });
            }).catch(done);
          });

          it('should log an error, finish the push and not clear the sync queue if an item push fails', function (done) {
            networkStore.removeById(entity3._id).then(function () {
              return storeToTest.push();
            }).then(function (result) {
              expect(result.length).to.equal(3);
              var errorRecord = _.find(result, function (entity) {
                return entity._id === entity3._id;
              });
              expect(errorRecord.error.name).to.equal(notFoundErrorName);
              return networkStore.find().toPromise();
            }).then(function (result) {
              expect(_.find(result, function (entity) {
                return entity.newProperty === updatedEntity2.newProperty;
              })).to.exist;
              expect(_.find(result, function (entity) {
                return entity._id === entity1._id;
              })).to.exist;
              return storeToTest.pendingSyncCount();
            }).then(function (count) {
              expect(count).to.equal(1);
              done();
            }).catch(done);
          });
        });

        describe('pull()', function () {

          beforeEach(function (done) {
            utilities.cleanUpCollectionData(collectionName).then(function () {
              return networkStore.save(entity1);
            }).then(function () {
              return networkStore.save(entity2);
            }).then(function () {
              return done();
            }).catch(done);
          });

          it('should save the entities from the backend in the cache', function (done) {
            storeToTest.pull().then(function (result) {
              return validatePullOperation(result, [entity1, entity2]);
            }).then(function () {
              return done();
            }).catch(done);
          });

          it('should pull only the entities, matching the query', function (done) {
            var query = new Kinvey.Query();
            query.equalTo('_id', entity1._id);
            storeToTest.pull(query).then(function (result) {
              return validatePullOperation(result, [entity1]);
            }).then(function () {
              return done();
            }).catch(done);
          });
        });

        describe('sync()', function () {

          var serverEntity1 = void 0;
          var serverEntity2 = void 0;

          beforeEach(function (done) {
            //creating two server items - three items, eligible for sync are already created in cache
            serverEntity1 = utilities.getEntity(utilities.randomString());
            serverEntity2 = utilities.getEntity(utilities.randomString());
            networkStore.save(serverEntity1).then(function () {
              return networkStore.save(serverEntity2);
            }).then(function () {
              return done();
            }).catch(done);
          });

          it('should push and then pull the entities from the backend in the cache', function (done) {
            var syncResult = void 0;
            storeToTest.sync().then(function (result) {
              syncResult = result;
              return validatePushOperation(syncResult.push, entity1, updatedEntity2, entity3, 5);
            }).then(function () {
              return validatePullOperation(syncResult.pull, [serverEntity1, serverEntity2, updatedEntity2], 5);
            }).then(function () {
              return done();
            }).catch(done);
          });

          it('should push and then pull only the entities, matching the query', function (done) {
            var syncResult = void 0;
            var query = new Kinvey.Query();
            query.equalTo('_id', updatedEntity2._id);
            storeToTest.sync(query).then(function (result) {
              syncResult = result;
              expect(syncResult.push.length).to.equal(1);
              expect(syncResult.push[0]._id).to.equal(updatedEntity2._id);
              return networkStore.find().toPromise();
            }).then(function (result) {
              expect(_.find(result, function (entity) {
                return entity._id === updatedEntity2._id;
              })).to.exist;
              return validatePullOperation(syncResult.pull, [updatedEntity2]);
            }).then(function () {
              return done();
            }).catch(done);
          });
        });
      });
    });
  });
}

runner.run(testFunc);