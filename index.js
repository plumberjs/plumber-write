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

function dataWithSourceMapping(resource) {
    var suffix;
    if (! resource.sourceMap()) {
        suffix = '';
    } else if (resource.type() === 'javascript') {
        suffix = '//# sourceMappingURL=' + resource.sourceMapFilename();
    } else {
        suffix = '/*# sourceMappingURL=' + resource.sourceMapFilename() + ' */';
    }
    return resource.data() + suffix;
}

function writeData(resource, destPath) {
    return writeFile(destPath.absolute(), dataWithSourceMapping(resource)).
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



module.exports = function(destination) {
    return function(resources) {
        var destPath = stringToPath(destination);

        // Trying to output multiple resources into a single file? That won't do
        if (resources.length > 1 && ! destPath.isDirectory()) {
            // FIXME: error now outputted ?
            return q.reject(new Error('Cannot write multiple resources to a single file: ' + destPath.absolute()));
        }

        return q.all(resources.map(function(resource) {
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
