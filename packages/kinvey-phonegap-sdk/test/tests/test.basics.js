runner.run(testFunc);

function testFunc() {
    describe.skip('test', function () { it('test')});
}
