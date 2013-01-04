[![build status](https://secure.travis-ci.org/rwldrn/grunt-compare-size.png)](http://travis-ci.org/rwldrn/grunt-compare-size)
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

Add an entry to your Gruntfile.js's `initConfig` object, which will define the files to measure the size of. The last file in the list will also be gzipped and measured.

```js
  ...

  compare_size: {
    files: [
      "library.js",
      "library.min.js"
    ]
  }

  ...
```

To run a size comparison:

```js
grunt compare_size
```

To add a labeled measurement to the saved list of measurements:

```js
grunt compare_size_add:<label>:...
```

To remove a labeled measurement:

```js
grunt compare_size_remove:<label>:...
```

To view all saved measurements:

```js
grunt compare_size_list
```

To clear out all saved measurements:

```js
grunt compare_size_empty
```


## Testing

Run tests like:

``` bash

# local grunt install
$ grunt

```

## License
Copyright (c) 2012 Rick Waldron <waldron.rick@gmail.com>, Corey Frang <gnarf@gnarf.net>, Richard Gibson <richard.gibson@gmail.com>, Mike Sherov <mike.sherov@gmail.com>
Licensed under the MIT license.
