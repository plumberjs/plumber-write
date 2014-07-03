var chai = require('chai');
var should = chai.should();


var fs = require('fs');
var rimraf = require('rimraf');


var Resource = require('plumber').Resource;
var mercator = require('mercator');
var SourceMap = mercator.SourceMap;
var readSourceMappingComment = mercator.readSourceMappingComment;

var runOperation = require('plumber-util-test').runOperation;
var completeWithResources = require('plumber-util-test').completeWithResources;

var write = require('..');


function readFile(path) {
    return fs.readFileSync(path, 'utf-8');
}

function resourcesError() {
  chai.assert(false, "error in resources observable");
}


describe('write', function() {
    var single;
    var singleData = 'var answer = 42;\n';

    var withMap;
    var withMapData = 'var line = 1;\nvar next = 2;\n';
    var withMapMap = SourceMap.forSource(withMapData, 'test/src/withMap.js');

    var multiple;
    var multi1Data = 'var multi = 1;\n';
    var multi2Data = 'var multi = 2;\n';

    beforeEach(function() {
        // Reset sandbox contents
        rimraf.sync('test/sandbox');
        fs.mkdirSync('test/sandbox');

        single = [
            new Resource({path: 'test/src/single.js', type: 'javascript',
                          data: singleData})
        ];

        withMap = [
            new Resource({path: 'test/src/withMap.js', type: 'javascript',
                          data: withMapData, sourceMap: withMapMap})
        ];

        multiple = [
            new Resource({path: 'test/src/multi-1.js', type: 'javascript',
                          data: multi1Data}),
            new Resource({path: 'test/src/multi-2.js', type: 'javascript',
                          data: multi2Data})
        ];
    });

    it('should be a function', function() {
        write.should.be.a('function');
    });

    describe('#apply with destination directory', function() {
        var writeToDir;

        beforeEach(function() {
            writeToDir = write('test/sandbox/dist-dir');
        });


        describe('when passed a single file', function() {
            var result;

            beforeEach(function() {
                result = runOperation(writeToDir, single).resources;
            });

            it('should write the data', function(done) {
                completeWithResources(result, function() {
                    var writtenData = readFile('test/sandbox/dist-dir/single.js');
                    writtenData.should.equal(singleData);
                }, resourcesError, done);
            });

            it('should return a report', function(done) {
                completeWithResources(result, function(reports) {
                    reports.length.should.equal(1);
                    reports[0].writtenResource.should.equal(single[0]);
                    reports[0].path.absolute().should.equal('test/sandbox/dist-dir/single.js');
                    reports[0].type.should.equal('write');
                }, resourcesError, done);
            });

            it('should reference no source map', function(done) {
                completeWithResources(result, function() {
                    var writtenData = readFile('test/sandbox/dist-dir/single.js');
                    var sourceMapPath = readSourceMappingComment(writtenData);
                    should.not.exist(sourceMapPath);
                }, resourcesError, done);
            });
        });


        describe('when passed multiple files', function() {
            var result;

            beforeEach(function() {
                result = runOperation(writeToDir, multiple).resources;
            });

            it('should write the data', function(done) {
                completeWithResources(result, function() {
                    var writtenData1 = readFile('test/sandbox/dist-dir/multi-1.js');
                    writtenData1.should.equal(multi1Data);

                    var writtenData2 = readFile('test/sandbox/dist-dir/multi-2.js');
                    writtenData2.should.equal(multi2Data);
                }, resourcesError, done);
            });

            it('should return multiple reports', function(done) {
                completeWithResources(result, function(reports) {
                    reports.length.should.equal(2);
                    reports[0].writtenResource.should.equal(multiple[0]);
                    reports[0].path.absolute().should.equal('test/sandbox/dist-dir/multi-1.js');
                    reports[0].type.should.equal('write');
                    reports[1].writtenResource.should.equal(multiple[1]);
                    reports[1].path.absolute().should.equal('test/sandbox/dist-dir/multi-2.js');
                    reports[1].type.should.equal('write');
                }, resourcesError, done);
            });
        });


        describe('when passed a single file with source map', function() {
            var result;

            beforeEach(function() {
                result = runOperation(writeToDir, withMap).resources;
            });

            it('should reference the source map', function(done) {
                completeWithResources(result, function() {
                    var writtenData = readFile('test/sandbox/dist-dir/withMap.js');
                    var sourceMapPath = readSourceMappingComment(writtenData);
                    sourceMapPath.should.equal('withMap.js.map');
                }, resourcesError, done);
            });

            it('should write the source map', function(done) {
                completeWithResources(result, function() {
                    var writtenMapData = readFile('test/sandbox/dist-dir/withMap.js.map');

                    var sourceMap = SourceMap.fromMapData(writtenMapData);
                    sourceMap.version.should.equal(3);
                    sourceMap.file.should.equal('withMap.js');
                    // paths relative to output dir
                    sourceMap.sources.should.deep.equal(['../../src/withMap.js']);
                    sourceMap.sourcesContent.should.deep.equal([withMapData]);
                    sourceMap.mappings.should.deep.equal(withMapMap.mappings);
                    sourceMap.names.should.deep.equal(withMapMap.names);
                }, resourcesError, done);
            });
        });
    });


    describe('#apply with destination file', function() {

        it('should throw an error', function() {
            (function() {
                write('test/sandbox/dist.js');
            }).should.throw('write operation expects the destination to be a directory');
        });

    });


    describe('#omitSourceMap (as prefix)', function() {
        var result;

        beforeEach(function() {
            var writeNoMap = write.omitSourceMap;
            var writeToDir = writeNoMap('test/sandbox/dist-nomap');
            result = runOperation(writeToDir, withMap).resources;
        });

        it('should not reference a source map', function(done) {
            completeWithResources(result, function() {
                var writtenData = readFile('test/sandbox/dist-nomap/withMap.js');
                var sourceMapPath = readSourceMappingComment(writtenData);
                should.not.exist(sourceMapPath);
            }, resourcesError, done);
        });

        it('should not write a source map', function(done) {
            completeWithResources(result, function() {
                var mapWritten = fs.existsSync('test/sandbox/dist-nomap/withMap.js.map');
                mapWritten.should.equal(false);
            }, resourcesError, done);
        });
    });


    describe('#omitSourceMap (as suffix)', function() {
        var writeToDirNoMap;
        var result;

        beforeEach(function() {
            var writeToDirNoMap = write('test/sandbox/dist-nomap').omitSourceMap;
            result = runOperation(writeToDirNoMap, withMap).resources;
        });

        it('should not reference a source map', function(done) {
            completeWithResources(result, function() {
                var writtenData = readFile('test/sandbox/dist-nomap/withMap.js');
                var sourceMapPath = readSourceMappingComment(writtenData);
                should.not.exist(sourceMapPath);
            }, resourcesError, done);
        });

        it('should not write a source map', function(done) {
            completeWithResources(result, function() {
                var mapWritten = fs.existsSync('test/sandbox/dist-nomap/withMap.js.map');
                mapWritten.should.equal(false);
            }, resourcesError, done);
        });
    });


    describe('#omitContentFromSourceMap (as prefix)', function() {
        var result;

        beforeEach(function() {
            var writeNoMap = write.omitContentFromSourceMap;
            var writeToDir = writeNoMap('test/sandbox/dist-nomapcontent');
            result = runOperation(writeToDir, withMap).resources;
        });

        it('should reference a source map', function(done) {
            completeWithResources(result, function() {
                var writtenData = readFile('test/sandbox/dist-nomapcontent/withMap.js');
                var sourceMapPath = readSourceMappingComment(writtenData);
                sourceMapPath.should.equal('withMap.js.map');
            }, resourcesError, done);
        });

        it('should not write a source map', function(done) {
            completeWithResources(result, function() {
                var writtenMapData = readFile('test/sandbox/dist-nomapcontent/withMap.js.map');
                var sourceMap = SourceMap.fromMapData(writtenMapData.toString());
                sourceMap.version.should.equal(3);
                sourceMap.file.should.equal('withMap.js');
                // paths relative to output dir
                sourceMap.sources.should.deep.equal(['../../src/withMap.js']);
                should.not.exist(sourceMap.sourcesContent);
                sourceMap.mappings.should.deep.equal(withMapMap.mappings);
                sourceMap.names.should.deep.equal(withMapMap.names);
            }, resourcesError, done);
        });
    });
});
