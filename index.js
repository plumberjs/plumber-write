var Report = require('plumber').Report;
var operation = require('plumber').operation;
var Rx = require('plumber').Rx;
// FIXME: better helper?
var stringToPath = require('plumber').stringToPath;
var mercator = require('mercator');
var Path = require('plumber/lib/model/path');

var fs = require('fs');
var path = require('path');
var mkdirpNode = require('mkdirp');

var mkdirp    = Rx.Observable.fromNodeCallback(mkdirpNode);
var writeFile = Rx.Observable.fromNodeCallback(fs.writeFile);


function createReport(resource, path) {
    return new Report({
        resource: resource,
        path: path,
        type: 'write'
    });
}

function defineGet(obj, method, func) {
    Object.defineProperty(obj, method, {
        get: func
    });
}


// Return the resource data with the suffix referencing the source
// map, if any.  Else, return the resource rawData (Buffer).
function dataWithSourceMapping(resource) {
    var suffix;
    if (resource.sourceMap()) {
        if (resource.type() === 'javascript') {
            suffix = mercator.generateJsSourceMappingComment(resource.sourceMapFilename());
        } else if (resource.type() === 'css') {
            suffix = mercator.generateCssSourceMappingComment(resource.sourceMapFilename());
        }
    }

    if (suffix) {
        // Add the suffix on a new line
        return resource.data() + (suffix && '\n') + suffix;
    } else {
        return resource.rawData();
    }
}

function writeData(resource, destPath) {
    return writeFile(destPath.absolute(), dataWithSourceMapping(resource)).
        map(function(){ return createReport(resource, destPath); });
}

function writeSourceMap(resource, destPath) {
    var sourceMap = resource.sourceMap();
    if (sourceMap) {
        var mapPath = destPath.withFilename(destPath.filename() + '.map');
        var targetDir = path.dirname(mapPath.absolute());
        var rebasedSourceMap = sourceMap.rebaseSourcePaths(targetDir);
        return writeFile(mapPath.absolute(), rebasedSourceMap.toString()).
            map(function(){ return createReport(resource, mapPath); });
    } else {
        return Rx.Observable.empty(); // will flatten to nothing
    }
}

function writeConfig(omitSourceMap, omitMapContent) {

    function write(destination) {
        var destPath = stringToPath(destination);
        if (! destPath.isDirectory()) {
            throw new Error('write operation expects the destination to be a directory');
        }

        var writeOperation = operation(function(resources) {
            return resources.flatMap(function(resource) {

                // Preserve path
                var destFile = new Path({
                    dirname: path.join(destPath.dirname(), resource.path().dirname()),
                    filename: resource.filename()
                });

                if (omitSourceMap) {
                    resource = resource.withoutSourceMap();
                }

                if (omitMapContent) {
                    var sourceMap = resource.sourceMap();
                    if (sourceMap) {
                        resource = resource.withSourceMap(sourceMap.withoutSourcesContent());
                    }
                }

                return mkdirp(destFile.dirname()).flatMap(function() {
                    return Rx.Observable.merge(
                        writeData(resource, destFile),
                        writeSourceMap(resource, destFile)
                    );
                });
            });
        });


        // Need to do it dynamically to avoid infinite recursion
        defineGet(writeOperation, 'omitSourceMap', function() {
            return writeConfig(true, omitMapContent)(destination);
        });
        defineGet(writeOperation, 'omitContentFromSourceMap', function() {
            return writeConfig(omitSourceMap, true)(destination);
        });

        return writeOperation;
    };

    // Need to do it dynamically to avoid infinite recursion
    defineGet(write, 'omitSourceMap', function() {
        return writeConfig(true, omitMapContent);
    });
    defineGet(write, 'omitContentFromSourceMap', function() {
        return writeConfig(omitSourceMap, true);
    });

    return write;
}

module.exports = writeConfig(false, false);
