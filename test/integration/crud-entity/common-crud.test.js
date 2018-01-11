'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function testFunc() {

  var dataStoreTypes = [Kinvey.DataStoreType.Network, Kinvey.DataStoreType.Sync, Kinvey.DataStoreType.Cache];
  var invalidQueryMessage = 'Invalid query. It must be an instance of the Query class.';
  var notFoundErrorName = 'NotFoundError';
  var collectionName = externalConfig.collectionName;

  dataStoreTypes.forEach(function (currentDataStoreType) {
    describe('CRUD Entity - ' + currentDataStoreType, function () {
      var textFieldName = Constants.TextFieldName;
      var numberFieldName = Constants.NumberFieldName;
      var arrayFieldName = Constants.ArrayFieldName;

      var networkStore = void 0;
      var storeToTest = void 0;
      var dataStoreType = currentDataStoreType;
      var createdUserIds = [];

      var entity1 = utilities.getEntity(utilities.randomString());
      var entity2 = utilities.getEntity(utilities.randomString());
      var entity3 = utilities.getEntity(utilities.randomString());

      before(function (done) {
        utilities.cleanUpAppData(collectionName, createdUserIds).then(function () {
          return Kinvey.User.signup();
        }).then(function (user) {
          createdUserIds.push(user.data._id);
          //store for setup
          networkStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Network);
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
      describe('find and count operations', function () {

        before(function (done) {
          networkStore.save(entity1).then(function () {
            return networkStore.save(entity2);
          }).then(function () {
            if (dataStoreType !== Kinvey.DataStoreType.Network) {
              return storeToTest.pull();
            }
          }).then(function () {
            return networkStore.save(entity3);
          }).then(function () {
            return done();
          }).catch(done);
        });

        describe('count()', function () {
          it('should throw an error for an invalid query', function (done) {
            storeToTest.count({}).subscribe(null, function (error) {
              try {
                expect(error.message).to.equal(invalidQueryMessage);
                done();
              } catch (e) {
                done(e);
              }
            });
          });

          it('should return the count for the collection', function (done) {
            var onNextSpy = sinon.spy();
            storeToTest.count().subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, 2, 3);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('should return the count of the entities that match the query', function (done) {
            var query = new Kinvey.Query();
            query.equalTo('_id', entity2._id);
            var onNextSpy = sinon.spy();
            storeToTest.count(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, 1, 1);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

        describe('find()', function () {
          it('should throw an error if the query argument is not an instance of the Query class', function (done) {
            storeToTest.find({}).subscribe(null, function (error) {
              try {
                expect(error.message).to.equal(invalidQueryMessage);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('should return all the entities', function (done) {
            var onNextSpy = sinon.spy();
            storeToTest.find().subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, [entity1, entity2], [entity1, entity2, entity3], true);
                return utilities.retrieveEntity(collectionName, Kinvey.DataStoreType.Sync, entity3).then(function (result) {
                  if (result) {
                    result = utilities.deleteEntityMetadata(result);
                  }
                  expect(result).to.deep.equal(dataStoreType === Kinvey.DataStoreType.Cache ? entity3 : undefined);
                  done();
                }).catch(done);
              } catch (error) {
                done(error);
              }
            });
          });

          it('should find the entities that match the query', function (done) {
            var onNextSpy = sinon.spy();
            var query = new Kinvey.Query();
            query.equalTo('_id', entity2._id);
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, [entity2], [entity2]);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

        describe('findById()', function () {
          it('should throw a NotFoundError if the id argument does not exist', function (done) {
            var entityId = utilities.randomString();
            storeToTest.findById(entityId).toPromise().then(function () {
              return done(new Error('Should not be called'));
            }).catch(function (error) {
              expect(error.name).to.contain(notFoundErrorName);
              done();
            }).catch(done);
          });

          it('should return undefined if an id is not provided', function (done) {
            storeToTest.findById().toPromise().then(function (result) {
              expect(result).to.be.undefined;
              done();
            }).catch(done);
          });

          it('should return the entity that matches the id argument', function (done) {
            var onNextSpy = sinon.spy();
            storeToTest.findById(entity2._id).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, entity2, entity2);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });
      });

      // These are smoke tests and will not be executed for now.
      // If we decide to execute 'Modifiers' describe only for Sync data store, these tests will be added back
      describe.skip('find with modifiers', function () {
        var entities = [];
        var dataCount = 10;
        before(function (done) {

          for (var i = 0; i < dataCount; i++) {
            entities.push(utilities.getEntity());
          }

          utilities.cleanUpCollectionData(collectionName).then(function () {
            return utilities.saveEntities(collectionName, entities);
          }).then(function (result) {
            entities = result;
            done();
          }).catch(done);
        });

        it('should sort ascending and skip correctly', function (done) {
          var onNextSpy = sinon.spy();
          var query = new Kinvey.Query();
          query.skip = dataCount - 2;
          query.ascending('_id');
          var expectedEntities = [entities[dataCount - 2], entities[dataCount - 1]];
          storeToTest.find(query).subscribe(onNextSpy, done, function () {
            try {
              utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
              done();
            } catch (error) {
              done(error);
            }
          });
        });

        it('should sort descending and limit correctly', function (done) {
          var onNextSpy = sinon.spy();
          var query = new Kinvey.Query();
          query.limit = 2;
          query.descending('_id');
          var expectedEntities = [entities[dataCount - 1], entities[dataCount - 2]];
          storeToTest.find(query).subscribe(onNextSpy, done, function () {
            try {
              utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
              done();
            } catch (error) {
              done(error);
            }
          });
        });

        it('should skip and limit correctly', function (done) {
          var onNextSpy = sinon.spy();
          var query = new Kinvey.Query();
          query.limit = 1;
          query.skip = dataCount - 2;
          query.ascending('_id');
          var expectedEntity = entities[dataCount - 2];
          storeToTest.find(query).subscribe(onNextSpy, done, function () {
            try {
              utilities.validateReadResult(dataStoreType, onNextSpy, [expectedEntity], [expectedEntity]);
              done();
            } catch (error) {
              done(error);
            }
          });
        });

        //skipped because of a bug for syncStore and different behaviour of fields for Sync and Network
        it.skip('with fields should return only the specified fields', function (done) {
          var onNextSpy = sinon.spy();
          var query = new Kinvey.Query();
          query.fields = [[textFieldName]];
          query.ascending('_id');
          var expectedEntity = _defineProperty({}, textFieldName, entities[dataCount - 2][textFieldName]);
          storeToTest.find(query).subscribe(onNextSpy, done, function () {
            try {
              utilities.validateReadResult(dataStoreType, onNextSpy, [expectedEntity], [expectedEntity]);
              done();
            } catch (error) {
              done(error);
            }
          });
        });
      });

      describe('Querying', function () {
        var entities = [];
        var dataCount = 10;
        var secondSortField = 'secondSortField';
        var onNextSpy = void 0;
        var query = void 0;

        before(function (done) {

          for (var i = 0; i < dataCount; i++) {
            entities.push(utilities.getEntity(null, 'test_' + i, i, ['test_' + i % 5, 'second_test_' + i % 5, 'third_test_' + i % 5]));
          }

          var textArray = ['aaa', 'aaB', 'aac'];
          for (var _i = 0; _i < dataCount; _i++) {
            entities[_i].secondSortField = textArray[_i % 3];
          }

          // used to test exists and size operators and null values
          entities[dataCount - 1][textFieldName] = null;
          delete entities[dataCount - 1][numberFieldName];
          entities[dataCount - 1][arrayFieldName] = [];
          entities[dataCount - 2][arrayFieldName] = [{}, {}];

          utilities.cleanUpCollectionData(collectionName).then(function () {
            return utilities.saveEntities(collectionName, entities);
          }).then(function (result) {
            entities = _.sortBy(result, numberFieldName);
            done();
          }).catch(done);
        });

        beforeEach(function (done) {
          onNextSpy = sinon.spy();
          query = new Kinvey.Query();
          done();
        });

        describe('Comparison operators', function () {

          it('query.equalTo', function (done) {
            query.equalTo(textFieldName, entities[5][textFieldName]);
            var expectedEntities = [entities[5]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.equalTo with null', function (done) {
            query.equalTo(textFieldName, null);
            var expectedEntities = [entities[dataCount - 1]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.notEqualTo', function (done) {
            query.notEqualTo(textFieldName, entities[5][textFieldName]);
            var expectedEntities = entities.filter(function (entity) {
              return entity != entities[5];
            });
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          //should be added back for execution when MLIBZ-2157 is fixed
          it.skip('query.notEqualTo with null', function (done) {
            query.notEqualTo(textFieldName, null);
            var expectedEntities = entities.filter(function (entity) {
              return entity[textFieldName] != null;
            });
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.greaterThan', function (done) {
            query.greaterThan(numberFieldName, entities[dataCount - 3][numberFieldName]);
            var expectedEntities = [entities[dataCount - 2]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.greaterThanOrEqualTo', function (done) {
            query.greaterThanOrEqualTo(numberFieldName, entities[dataCount - 3][numberFieldName]);
            var expectedEntities = [entities[dataCount - 3], entities[dataCount - 2]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.lessThan', function (done) {
            query.lessThan(numberFieldName, entities[2][numberFieldName]);
            var expectedEntities = [entities[0], entities[1]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.lessThanOrEqualTo', function (done) {
            query.lessThanOrEqualTo(numberFieldName, entities[1][numberFieldName]);
            var expectedEntities = [entities[0], entities[1]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.exists', function (done) {
            query.exists(numberFieldName);
            var expectedEntities = entities.filter(function (entity) {
              return entity != entities[dataCount - 1];
            });
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.mod', function (done) {
            query.mod(numberFieldName, 4, 2);
            var expectedEntities = entities.filter(function (entity) {
              return entity[numberFieldName] % 4 === 2;
            });
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          //TODO: Add more tests for regular expression
          it('query.matches - with RegExp literal', function (done) {
            query.matches(textFieldName, /^test_5/);
            var expectedEntities = [entities[5]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('query.matches - with RegExp object', function (done) {
            query.matches(textFieldName, new RegExp('^test_5'));
            var expectedEntities = [entities[5]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                done();
              } catch (error) {
                done(error);
              }
            });
          });

          it('multiple operators', function (done) {
            query.lessThan(numberFieldName, entities[2][numberFieldName]).greaterThan(numberFieldName, entities[0][numberFieldName]);
            var expectedEntities = [entities[1]];
            storeToTest.find(query).subscribe(onNextSpy, done, function () {
              try {
                utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

        describe('Array Operators', function () {

          describe('query.contains()', function () {

            it('with single value', function (done) {
              query.contains(textFieldName, entities[5][textFieldName]);
              var expectedEntities = [entities[5]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('string field with an array of values', function (done) {
              query.contains(textFieldName, entities[0][arrayFieldName]);
              var expectedEntities = [entities[0]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('array field with an array of values', function (done) {
              query.contains(arrayFieldName, entities[0][arrayFieldName]);
              var expectedEntities = [entities[0], entities[5]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('in combination with an existing filter', function (done) {
              query.notEqualTo(numberFieldName, entities[1][numberFieldName]);
              query.contains(textFieldName, [entities[0][textFieldName], entities[1][textFieldName]]);
              var expectedEntities = [entities[0]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('with null value', function (done) {
              query.contains(textFieldName, [null]);
              var expectedEntities = [entities[dataCount - 1]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });
          });

          describe('query.containsAll()', function () {

            it('with single value', function (done) {
              query.containsAll(textFieldName, entities[5][textFieldName]);
              var expectedEntities = [entities[5]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('string field with an array of values', function (done) {
              query.containsAll(textFieldName, [entities[5][textFieldName]]);
              var expectedEntities = [entities[5]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('array field with an array of values', function (done) {
              var arrayFieldValue = entities[5][arrayFieldName];
              var filteredArray = arrayFieldValue.filter(function (entity) {
                return entity != arrayFieldValue[2];
              });
              query.containsAll(arrayFieldName, filteredArray);
              var expectedEntities = [entities[0], entities[5]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('in combination with an existing filter', function (done) {
              query.notEqualTo(numberFieldName, entities[0][numberFieldName]);
              query.containsAll(arrayFieldName, entities[5][arrayFieldName]);
              var expectedEntities = [entities[5]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });
          });

          describe('query.notContainedIn()', function () {

            it('with single value', function (done) {
              query.notContainedIn(textFieldName, entities[5][textFieldName]);
              var expectedEntities = entities.filter(function (entity) {
                return entity != entities[5];
              });
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('string property with an array of values', function (done) {
              query.notContainedIn(textFieldName, entities[0][arrayFieldName]);
              var expectedEntities = entities.filter(function (entity) {
                return entity != entities[0];
              });
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('array field with an array of values', function (done) {
              query.notContainedIn(arrayFieldName, entities[0][arrayFieldName]);
              var expectedEntities = entities.filter(function (entity) {
                return entity != entities[0] && entity != entities[5];
              });
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('in combination with an existing filter', function (done) {
              query.lessThanOrEqualTo(numberFieldName, entities[1][numberFieldName]);
              query.notContainedIn(textFieldName, entities[0][arrayFieldName]);
              var expectedEntities = [entities[1]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });
          });

          describe('query.size()', function () {

            it('should return the elements with an array field, having the submitted size', function (done) {
              query.size(arrayFieldName, 3);
              var expectedEntities = entities.filter(function (entity) {
                return entity != entities[dataCount - 1] && entity != entities[dataCount - 2];
              });
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities, true);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('should return the elements with an empty array field, if the submitted size = 0', function (done) {
              query.size(arrayFieldName, 0);
              var expectedEntities = [entities[dataCount - 1]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('in combination with an existing filter', function (done) {
              query.greaterThanOrEqualTo(numberFieldName, entities[dataCount - 3][numberFieldName]);
              query.size(arrayFieldName, 3);
              var expectedEntities = [entities[dataCount - 3]];
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });
          });
        });

        describe('Modifiers', function () {

          var expectedAscendingCache = void 0;
          var expectedAscendingServer = void 0;
          var expectedDescending = void 0;

          describe('Sort', function () {

            before(function (done) {
              expectedAscendingCache = _.sortBy(entities, numberFieldName);
              expectedAscendingServer = _.sortBy(entities, numberFieldName);
              expectedAscendingServer.splice(0, 0, expectedAscendingServer.pop());
              expectedDescending = expectedAscendingServer.slice().reverse();
              done();
            });

            it('should sort ascending', function (done) {
              query.ascending(numberFieldName);
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  //when MLIBZ-2156 is fixed, expectedAscendingCache should be replaced with expectedAscendingServer
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedAscendingCache, expectedAscendingServer);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('should sort descending', function (done) {
              query.descending(numberFieldName);
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedDescending, expectedDescending);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('should sort by two fields ascending and descending', function (done) {
              query.ascending(secondSortField);
              query.descending(textFieldName);
              query.notEqualTo('_id', entities[dataCount - 1]._id);
              var sortedEntities = _.orderBy(entities, [secondSortField, numberFieldName], ['asc', 'desc']);
              var expectedEntities = sortedEntities.filter(function (entity) {
                return entity != entities[dataCount - 1];
              });
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('should skip correctly', function (done) {
              query.skip = dataCount - 3;
              query.descending(numberFieldName);
              var expectedEntities = expectedDescending.slice(dataCount - 3, dataCount);
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('should limit correctly', function (done) {
              query.limit = 2;
              query.descending(numberFieldName);
              var expectedEntities = expectedDescending.slice(0, 2);
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });

            it('should skip and then limit correctly', function (done) {
              query.limit = 2;
              query.skip = 3;
              query.descending(numberFieldName);
              var expectedEntities = expectedDescending.slice(3, 5);
              storeToTest.find(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, expectedEntities, expectedEntities);
                  done();
                } catch (error) {
                  done(error);
                }
              });
            });
          });
        });
      });

      describe('save()', function () {

        before(function (done) {
          utilities.cleanUpCollectionData(collectionName).then(function () {
            return utilities.saveEntities(collectionName, [entity1, entity2]);
          }).then(function () {
            return done();
          }).catch(done);
        });

        beforeEach(function (done) {
          if (dataStoreType !== Kinvey.DataStoreType.Network) {
            return storeToTest.clearSync().then(function () {
              return done();
            });
          } else {
            done();
          }
        });

        it('should throw an error when trying to save an array of entities', function (done) {
          storeToTest.save([entity1, entity2]).catch(function (error) {
            expect(error.message).to.equal('Unable to create an array of entities.');
            done();
          }).catch(done);
        });

        it('should create a new entity without _id', function (done) {
          var newEntity = _defineProperty({}, textFieldName, utilities.randomString());

          storeToTest.save(newEntity).then(function (createdEntity) {
            expect(createdEntity._id).to.exist;
            expect(createdEntity[textFieldName]).to.equal(newEntity[textFieldName]);
            if (dataStoreType === Kinvey.DataStoreType.Sync) {
              expect(createdEntity._kmd.local).to.be.true;
            } else {
              utilities.assertEntityMetadata(createdEntity);
            }
            newEntity._id = createdEntity._id;
            return utilities.validateEntity(dataStoreType, collectionName, newEntity);
          }).then(function () {
            return utilities.validatePendingSyncCount(dataStoreType, collectionName, 1);
          }).then(function () {
            return done();
          }).catch(done);
        });

        it('should create a new entity using its _id', function (done) {
          var id = utilities.randomString();
          var textFieldValue = utilities.randomString();
          var newEntity = utilities.getEntity(id, textFieldValue);

          storeToTest.save(newEntity).then(function (createdEntity) {
            expect(createdEntity._id).to.equal(id);
            expect(createdEntity[textFieldName]).to.equal(textFieldValue);
            return utilities.validateEntity(dataStoreType, collectionName, newEntity);
          }).then(function () {
            return done();
          }).catch(done);
        });

        it('should update an existing entity', function (done) {
          var _entityToUpdate;

          var entityToUpdate = (_entityToUpdate = {
            _id: entity1._id
          }, _defineProperty(_entityToUpdate, textFieldName, entity1[textFieldName]), _defineProperty(_entityToUpdate, 'newProperty', utilities.randomString()), _entityToUpdate);

          storeToTest.save(entityToUpdate).then(function (updatedEntity) {
            expect(updatedEntity._id).to.equal(entity1._id);
            expect(updatedEntity.newProperty).to.equal(entityToUpdate.newProperty);
            return utilities.validateEntity(dataStoreType, collectionName, entityToUpdate, 'newProperty');
          }).then(function () {
            return utilities.validatePendingSyncCount(dataStoreType, collectionName, 1);
          }).then(function () {
            return done();
          }).catch(done);
        });
      });

      describe('destroy operations', function () {

        before(function (done) {
          utilities.cleanUpCollectionData(collectionName).then(function () {
            return utilities.saveEntities(collectionName, [entity1, entity2]);
          }).then(function () {
            return done();
          }).catch(done);
        });

        describe('removeById()', function () {
          it('should throw an error if the id argument does not exist', function (done) {
            storeToTest.removeById(utilities.randomString()).catch(function (error) {
              if (dataStoreType === Kinvey.DataStoreType.Network) {
                expect(error.name).to.contain(notFoundErrorName);
              } else {
                expect(error).to.exist;
              }
              done();
            }).catch(done);
          });

          it('should remove only the entity that matches the id argument', function (done) {
            var newEntity = {
              _id: utilities.randomString()
            };
            storeToTest.save(newEntity).then(function () {
              return storeToTest.removeById(newEntity._id);
            }).then(function (result) {
              expect(result.count).to.equal(1);
              var onNextSpy = sinon.spy();
              var query = new Kinvey.Query();
              query.equalTo('_id', newEntity._id);
              return storeToTest.count(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, 0, 0);
                  return storeToTest.count().toPromise().then(function (count) {
                    expect(count).to.equal(2);
                    done();
                  }).catch(done);
                } catch (error) {
                  done(error);
                }
              });
            });
          });
        });

        describe('remove()', function () {

          before(function (done) {
            if (dataStoreType !== Kinvey.DataStoreType.Network) {
              return storeToTest.clearSync().then(function () {
                return done();
              });
            } else {
              done();
            }
          });

          it('should throw an error for an invalid query', function (done) {
            storeToTest.remove({}).catch(function (error) {
              expect(error.message).to.equal(invalidQueryMessage);
              done();
            }).catch(done);
          });

          it('should remove all entities that match the query', function (done) {
            var newEntity = utilities.getEntity();
            var query = new Kinvey.Query();
            query.equalTo(textFieldName, newEntity[textFieldName]);
            var initialCount = void 0;
            utilities.saveEntities(collectionName, [newEntity, newEntity]).then(function () {
              return storeToTest.count().toPromise();
            }).then(function (count) {
              initialCount = count;
              return storeToTest.remove(query);
            }).then(function (result) {
              expect(result.count).to.equal(2);
              var onNextSpy = sinon.spy();
              return storeToTest.count(query).subscribe(onNextSpy, done, function () {
                try {
                  utilities.validateReadResult(dataStoreType, onNextSpy, 0, 0);
                  return storeToTest.count().toPromise().then(function (count) {
                    expect(count).to.equal(initialCount - 2);
                    done();
                  }).catch(done);
                } catch (error) {
                  done(error);
                }
              });
            }).catch(done);
          });

          it('should return a { count: 0 } when no entities are removed', function (done) {
            var query = new Kinvey.Query();
            query.equalTo('_id', utilities.randomString());
            storeToTest.remove(query).then(function (result) {
              expect(result.count).to.equal(0);
              done();
            }).catch(done);
          });
        });
      });
    });
  });
}

runner.run(testFunc);