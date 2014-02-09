plumber-write [![Build Status](https://travis-ci.org/plumberjs/plumber-write.png?branch=master)](https://travis-ci.org/plumberjs/plumber-write)
=============

Write-to-filesystem operation for [Plumber](https://github.com/plumberjs/plumber) pipelines.

## Example

    var write = require('plumber-write');

    module.exports = function(pipelines) {

        pipelines['compile'] = [
            // ... pipeline operations
            write('target/dist')
        ];

    };


## API

### `write(destination)`

Write all input resources to the `destination` directory.

A `Report` is generated for each resources written to disk.

### `write.omitSourceMap`

Returns a new write operation that won't write out the source map
data.

`omitSourceMap` can be used either as a prefix or suffix:

    var writeNoMap = write.omitSourceMap;

    pipelines['compile'] = [
        // ... pipeline operations
        writeNoMap('target/dist')
    ];

    // or

    pipelines['compile'] = [
        // ... pipeline operations
        write('target/dist').omitSourceMap
    ];

### `write.omitContentFromSourceMap`

Returns a new write operation that will write out source maps without
the `sourcesContent`.

Like `omitSourceMap`, `omitContentFromSourceMap` can be used either as a prefix or suffix.
