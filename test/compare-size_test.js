var grunt = require("grunt"),
    file = require("fs"),
    sizecache = "./dist/.sizecache.json",
    dummy = { "dist/source.js": 0, "dist/source.min.js": 0, "dist/source.min.js.gz": 0 };

// Set .sizecache.json entries to zero
grunt.file.write(
  sizecache,
  JSON.stringify( dummy )
);

exports["compare_size"] = {
  "execution": function( test ) {

    grunt.utils.spawn({
      cmd: "grunt",
      args: [ "compare_size" ]
    }, function( err, result ) {
      var output = result.toString();

      test.ok( /Sizes - compared to/.test(output), "Sizes - compared to" );

      Object.keys( dummy ).forEach(function( key ) {
        test.ok( (new RegExp( key )).test( output ), "Displayed file name: " + key );
      });
      test.done();
    });
  },
  "aftermath": function( test ) {
    var saved = JSON.parse( grunt.file.read( sizecache ) );

    Object.keys( saved ).forEach(function( key ) {
      test.ok( saved[ key ], "Size is not zero: " + key );
    });
    test.done();
  }
};
