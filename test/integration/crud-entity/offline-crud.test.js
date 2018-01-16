'use strict';

function testFunc() {

  var dataStoreTypes = [Kinvey.DataStoreType.Cache, Kinvey.DataStoreType.Sync];
  var notFoundErrorName = 'NotFoundError';
  var shouldNotBeCalledErrorMessage = 'Should not be called';
  var collectionName = externalConfig.collectionName;

  dataStoreTypes.forEach(function (currentDataStoreType) {
    describe(currentDataStoreType + ' Store CRUD Specific Tests', function () {

      var networkStore = void 0;
      var syncStore = void 0;
      var cacheStore = void 0;
      var storeToTest = void 0;
      var dataStoreType = currentDataStoreType;
      var entity1 = utilities.getEntity(utilities.randomString());
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

      beforeEach(function (done) {
        utilities.cleanUpCollectionData(collectionName).then(function () {
          return cacheStore.save(entity1);
        }).then(function () {
          return done();
        }).catch(done);
      });

      after(function (done) {
        utilities.cleanUpAppData(collectionName, createdUserIds).then(function () {
          return done();
        }).catch(done);
      });

      if (dataStoreType === Kinvey.DataStoreType.Cache) {
        describe('local cache removal', function () {

          it('find() should remove entities that no longer exist in the backend from the cache', function (done) {
            var entity = utilities.getEntity(utilities.randomString());
            storeToTest.save(entity).then(function (entity) {
              return networkStore.removeById(entity._id);
            }).then(function () {
              return storeToTest.find().toPromise();
            }).then(function () {
              return syncStore.findById(entity._id).toPromise();
            }).then(function () {
              return done(new Error(shouldNotBeCalledErrorMessage));
            }).catch(function (error) {
              expect(error.name).to.equal(notFoundErrorName);
              syncStore.count().toPromise().then(function (count) {
                expect(count).to.equal(1);
                done();
              });
            }).catch(done);
          });

          it.skip('findById() should remove entities that no longer exist on the backend from the cache', function (done) {
            var entity = utilities.getEntity(utilities.randomString());
            storeToTest.save(entity).then(function (entity) {
              return networkStore.removeById(entity._id);
            }).then(function () {
              return storeToTest.findById(entity._id).toPromise();
            }).catch(function (error) {
              expect(error.name).to.equal(notFoundErrorName);
              return syncStore.findById(entity._id).toPromise();
            }).then(function () {
              done(new Error(shouldNotBeCalledErrorMessage));
            }).catch(function (error) {
              expect(error.name).to.equal(notFoundErrorName);
              return syncStore.count().toPromise().then(function (count) {
                expect(count).to.equal(1);
                done();
              });
            }).catch(done);
          });

          it('removeById should remove the entity from cache even if the entity is not found on the backend', function (done) {
            var entity = utilities.getEntity(utilities.randomString());
            storeToTest.save(entity).then(function (entity) {
              return networkStore.removeById(entity._id);
            }).then(function () {
              return storeToTest.removeById(entity._id);
            }).then(function (result) {
              expect(result.count).to.equal(1);
              return syncStore.findById(entity._id).toPromise();
            }).then(function () {
              return done(new Error(shouldNotBeCalledErrorMessage));
            }).catch(function (error) {
              expect(error.name).to.equal(notFoundErrorName);
              done();
            }).catch(done);
          });
        });
      }

      describe('clear()', function () {

        it('should remove the entities from the cache, which match the query', function (done) {
          var randomId = utilities.randomString();
          cacheStore.save({ '_id': randomId }).then(function () {
            var query = new Kinvey.Query();
            query.equalTo('_id', randomId);
            return storeToTest.clear(query);
          }).then(function (result) {
            expect(result.count).to.equal(1);
            return syncStore.count().toPromise();
          }).then(function (count) {
            expect(count).to.equal(1);
            return networkStore.count().toPromise();
          }).then(function (count) {
            expect(count).to.equal(2);
            done();
          }).catch(done);
        });

        it('should remove all entities only from the cache', function (done) {
          cacheStore.save({}).then(function () {
            return storeToTest.clear();
          }).then(function (result) {
            expect(result.count).to.equal(2);
            return syncStore.count().toPromise();
          }).then(function (count) {
            expect(count).to.equal(0);
            return networkStore.count().toPromise();
          }).then(function (count) {
            expect(count).to.equal(2);
            done();
          }).catch(done);
        });
      });
    });
  });
}

runner.run(testFunc);