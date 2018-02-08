function testFunc() {
  const dataStoreTypes = [Kinvey.DataStoreType.Cache, Kinvey.DataStoreType.Sync];
  const notFoundErrorName = 'NotFoundError';
  const shouldNotBeCalledErrorMessage = 'Should not be called';
  const { collectionName } = externalConfig;

  dataStoreTypes.forEach((currentDataStoreType) => {
    describe(`${currentDataStoreType} Store CRUD Specific Tests`, () => {
      let networkStore;
      let syncStore;
      let cacheStore;
      let storeToTest;
      const dataStoreType = currentDataStoreType;
      const entity1 = utilities.getEntity(utilities.randomString());
      const createdUserIds = [];

      before((done) => {
        utilities.cleanUpAppData(collectionName, createdUserIds)
          .then(() => Kinvey.User.signup())
          .then((user) => {
            createdUserIds.push(user.data._id);
            // store for setup
            networkStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Network);
            syncStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
            cacheStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Cache);
            // store to test
            storeToTest = Kinvey.DataStore.collection(collectionName, dataStoreType);
            done();
          })
          .catch(done);
      });

      beforeEach((done) => {
        utilities.cleanUpCollectionData(collectionName)
          .then(() => cacheStore.save(entity1))
          .then(() => done())
          .catch(done);
      });

      after((done) => {
        utilities.cleanUpAppData(collectionName, createdUserIds)
          .then(() => done())
          .catch(done);
      });

      if (dataStoreType === Kinvey.DataStoreType.Cache) {
        describe('local cache removal', () => {
          it('find() should remove entities that no longer exist in the backend from the cache', (done) => {
            const entity = utilities.getEntity(utilities.randomString());
            storeToTest.save(entity)
              .then((entity) => networkStore.removeById(entity._id))
              .then(() => storeToTest.find().toPromise())
              .then(() => syncStore.findById(entity._id).toPromise())
              .then(() => done(new Error(shouldNotBeCalledErrorMessage)))
              .catch((error) => {
                expect(error.name).to.equal(notFoundErrorName);
                syncStore.count().toPromise()
                  .then((count) => {
                    expect(count).to.equal(1);
                    done();
                  });
              })
              .catch(done);
          });

          it('findById() should create in the cache, an entity found on the backend, but missing in the cache', (done) => {
            const entity = utilities.getEntity(utilities.randomString());
            networkStore.create(entity)
              .then(() => storeToTest.findById(entity._id).toPromise())
              .then((foundEntity) => {
                expect(foundEntity).to.exist;
                return syncStore.findById(entity._id).toPromise();
              })
              .then(() => utilities.validateEntity(dataStoreType, collectionName, entity))
              .then(() => cacheStore.removeById(entity._id)) // remove the new entity, as it is not used elsewhere
              .then((result) => {
                expect(result).to.deep.equal({ count: 1 });
                done();
              })
              .catch(done);
          });

          it.skip('findById() should remove entities that no longer exist on the backend from the cache', (done) => {
            const entity = utilities.getEntity(utilities.randomString());
            storeToTest.save(entity)
              .then((entity) => networkStore.removeById(entity._id))
              .then(() => storeToTest.findById(entity._id).toPromise())
              .catch((error) => {
                expect(error.name).to.equal(notFoundErrorName);
                return syncStore.findById(entity._id).toPromise();
              })
              .then(() => {
                done(new Error(shouldNotBeCalledErrorMessage));
              })
              .catch((error) => {
                expect(error.name).to.equal(notFoundErrorName);
                return syncStore.count().toPromise()
                  .then((count) => {
                    expect(count).to.equal(1);
                    done();
                  });
              })
              .catch(done);
          });

          it('removeById should remove the entity from cache even if the entity is not found on the backend', (done) => {
            const entity = utilities.getEntity(utilities.randomString());
            storeToTest.save(entity)
              .then((entity) => networkStore.removeById(entity._id))
              .then(() => storeToTest.removeById(entity._id))
              .then((result) => {
                expect(result.count).to.equal(1);
                return syncStore.findById(entity._id).toPromise();
              })
              .then(() => {
                return done(new Error(shouldNotBeCalledErrorMessage));
              })
              .catch((error) => {
                expect(error.name).to.equal(notFoundErrorName);
                done();
              })
              .catch(done);
          });
        });
      }

      describe('clear()', () => {
        it('should remove the entities from the cache, which match the query', (done) => {
          const randomId = utilities.randomString();
          cacheStore.save({ _id: randomId })
            .then(() => {
              const query = new Kinvey.Query();
              query.equalTo('_id', randomId);
              return storeToTest.clear(query);
            })
            .then((result) => {
              expect(result.count).to.equal(1);
              return syncStore.count().toPromise();
            })
            .then((count) => {
              expect(count).to.equal(1);
              return networkStore.count().toPromise();
            })
            .then((count) => {
              expect(count).to.equal(2);
              done();
            })
            .catch(done);
        });

        it('should remove sync entities only for entities, which match the query', (done) => {
          const randomId = utilities.randomString();
          const updatedEntity1 = {
            _id: entity1._id,
            someNewProperty: 'any value'
          };

          syncStore.update({ _id: randomId })
            .then((result) => {
              expect(result).to.deep.equal({ _id: randomId });
              return syncStore.update(updatedEntity1);
            })
            .then((result) => {
              expect(result).to.deep.equal(updatedEntity1);
              return storeToTest.pendingSyncEntities();
            })
            .then((syncEntities) => {
              expect(syncEntities.map(e => e.entityId).sort()).to.deep.equal([entity1._id, randomId].sort());
              const query = new Kinvey.Query().equalTo('_id', entity1._id);
              return storeToTest.clear(query);
            })
            .then((result) => {
              expect(result).to.deep.equal({ count: 1 });
              return storeToTest.pendingSyncEntities();
            })
            .then((result) => {
              expect(result.length).to.equal(1);
              expect(result[0].entityId).to.equal(randomId);
              done();
            })
            .catch(done);
        });

        it('should remove all entities only from the cache', (done) => {
          cacheStore.save({})
            .then(() => storeToTest.clear())
            .then((result) => {
              expect(result.count).to.equal(2);
              return syncStore.count().toPromise();
            })
            .then((count) => {
              expect(count).to.equal(0);
              return networkStore.count().toPromise();
            })
            .then((count) => {
              expect(count).to.equal(2);
              done();
            })
            .catch(done);
        });
      });
    });
  });
}

runner.run(testFunc);
