# grunt-compare-size

Compare file sizes on this branch to master

## Getting Started

Add this to your project's `Gruntfile.js` gruntfile:
```javascript
grunt.loadNpmTasks('grunt-compare-size');
```

Then add "grunt-compare-size" to your package.json dependencies.

Then install the plugin with: `npm install`

The name to use in your own task definitions is `compare_size` (with an underscore).

## Documentation

 - `grunt compare_size_add:<label>:...`
 - `grunt compare_size_remove:<label>:...`
 - `grunt compare_size_list`
 - `grunt compare_size_empty`


## Testing

Run tests like:

``` bash

# local grunt install
$ grunt

```

## License
Copyright (c) 2012 Rick Waldron <waldron.rick@gmail.com>, Corey Frang <gnarf@gnarf.net>, Richard Gibson <richard.gibson@gmail.com>, Mike Sherov <mike.sherov@gmail.com>
Licensed under the MIT license.
