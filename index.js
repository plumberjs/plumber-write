var Report = require('plumber').Report;
// FIXME: better helper?
var stringToPath = require('plumber').stringToPath;
var mercator = require('mercator');

var q = require('q');
var fs = require('fs');
var path = require('path');
var mkdirpNode = require('mkdirp');
var flatten = require('flatten');

var mkdirp = q.denodeify(mkdirpNode);
var writeFile = q.denodeify(fs.writeFile);


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


function when(cond, op) {
    return function(resource) {
        if (cond(resource)) {
            return op(resource);
        } else {
            return resource;
        }
    };
}

function isNotReport(resourceOrReport) {
    return typeof resourceOrReport.type !== 'string';
}


function dataWithSourceMapping(resource) {
    var suffix;
    if (! resource.sourceMap()) {
        suffix = '';
    } else if (resource.type() === 'javascript') {
        suffix = mercator.generateJsSourceMappingComment(resource.sourceMapFilename());
    } else if (resource.type() === 'css') {
        suffix = mercator.generateCssSourceMappingComment(resource.sourceMapFilename());
    } else {
        // No suffix for other types
        suffix = '';
    }
    // Add the suffix on a new line
    return resource.data() + (suffix && '\n') + suffix;
}

function writeData(resource, destPath) {
    return writeFile(destPath.absolute(), dataWithSourceMapping(resource)).
        thenResolve(createReport(resource, destPath));
}

function writeSourceMap(resource, destPath) {
    var sourceMap = resource.sourceMap();
    if (sourceMap) {
        var mapPath = destPath.withFilename(destPath.filename() + '.map');
        var targetDir = path.dirname(mapPath.absolute());
        var rebasedSourceMap = sourceMap.rebaseSourcePaths(targetDir);
        return writeFile(mapPath.absolute(), rebasedSourceMap.toString()).
            thenResolve(createReport(resource, mapPath));
    } else {
        return q.resolve([]); // will flatten to nothing
    }
}


function writeConfig(omitSourceMap, omitMapContent) {

    function write(destination) {
        var destPath = stringToPath(destination);

        // FIXME: only accept directory destinations?

        function writeOperation(resources) {
            // Trying to output multiple resources into a single file? That won't do
            if (resources.length > 1 && ! destPath.isDirectory()) {
                // FIXME: error not outputted ?
                return q.reject(new Error('Cannot write multiple resources to a single file: ' + destPath.absolute()));
            }

            return q.all(resources.map(when(isNotReport, function(resource) {
                var destFile;
                if (destPath.isDirectory()) {
                    destFile = destPath.withFilename(resource.filename());
                } else {
                    destFile = destPath;
                }

                if (omitSourceMap) {
                    resource = resource.withoutSourceMap();
                }

                if (omitMapContent) {
                    var sourceMap = resource.sourceMap();
                    if (sourceMap) {
                        resource = resource.withSourceMap(sourceMap.withoutSourcesContent());
                    }
                }

                return mkdirp(destFile.dirname()).then(function() {
                    return q.all([
                        writeData(resource, destFile),
                        writeSourceMap(resource, destFile)
                    ]);
                });
            }))).then(flatten);
        };


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
