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
