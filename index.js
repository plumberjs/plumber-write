var Report = require('plumber').Report;
// FIXME: better helper?
var stringToPath = require('plumber').stringToPath;

var q = require('q');
var fs = require('fs');
var mkdirpNode = require('mkdirp');
var flatten = require('flatten');

var mkdirp = q.denodeify(mkdirpNode);

var writeFile = q.denodeify(fs.writeFile);


function createReport(resource) {
    return new Report({
        resource: resource,
        type: 'write'
    });
}


function writeData(resource, destPath) {
    return writeFile(destPath.absolute(), resource.data()).
        thenResolve(createReport(destPath));
}

function writeSourceMap(resource, destPath) {
    if (resource.sourceMap()) {
        var mapPath = destPath.withFilename(destPath.filename() + '.map');
        return writeFile(mapPath.absolute(), resource.sourceMap()).
            thenResolve(createReport(mapPath));
    } else {
        return q.resolve([]); // will flatten to nothing
    }
}



// FIXME: don't accept varia-type argument; use separate helpers?
module.exports = function(destination) {
    return function(resources) {
        var getDest;

        if (typeof destination === 'string') {
            var destPath = stringToPath(destination);

            // Trying to output multiple resources into a single file? That won't do
            if (resources.length > 1 && ! destPath.isDirectory()) {
                // FIXME: error now outputted ?
                return q.reject(new Error('Cannot write multiple resources to a single file: ' + destPath.absolute()));
            }

            getDest = function() { return destPath; };
        } else if (typeof destination === 'function') {
            getDest = function(resource) {
                return stringToPath(destination(resource));
            };
        }

        return q.all(resources.map(function(resource) {
            var destPath = getDest(resource);

            var destFile;
            if (destPath.isDirectory()) {
                destFile = destPath.withFilename(resource.filename());
            } else {
                destFile = destPath;
            }

            return mkdirp(destFile.dirname()).then(function() {
                return q.all([
                    writeData(resource, destFile),
                    writeSourceMap(resource, destFile)
                ]);
            });
        })).then(flatten);
    };
};
