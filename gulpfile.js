var gulp = require('gulp');
var gutil = require('gulp-util');
var noop = gutil.noop;
var uglify = require('gulp-uglify');
var less = require('gulp-less');
var minifyCSS = require('gulp-minify-css');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');

// Dev only
var livereload, injectReload, watch, karma;

var C = {
  dev: false,
  port: process.env.PORT || 4000,
  lrPort: 35729 + Math.floor(Math.random() * 100),
  paths: {
    scripts: 'src/**/*.js',
    styles:  'src/**/*.less',
    markup:   'src/**/*.html'
  }
};

gulp.task('clean', function(cb){
  del(['dist/**'], cb);
});

gulp.task('webserver', function(){
  var connect = require('connect');
  var serveStatic = require('serve-static');
  var http = require('http');
  var path = require('path');

  var base = path.resolve('dist');
  var app = connect().use(serveStatic(base));
  return http.createServer(app).listen(C.port, null);
});

gulp.task('scripts', function(){
  var p = C.paths.scripts;
  return gulp.src(p)
    .pipe( C.dev ? watch(p)                        : noop())
    .pipe(         sourcemaps.init() )
    //.pipe(         uglify({ outSourceMaps: true })         )
    .pipe(         sourcemaps.write('.') )
    .pipe(         gulp.dest('dist')                       )
    .pipe( C.dev ? livereload()                    : noop());
});

gulp.task('styles', function(){
  var p = C.paths.styles;
  return gulp.src(p)
    .pipe( C.dev ? watch(p)          : noop() )
    .pipe(         less()                     )
    .pipe(         minifyCSS()                )
    .pipe(         gulp.dest('dist')          )
    .pipe( C.dev ? livereload()      : noop() );
});

gulp.task('markup', function(){
  var p = C.paths.markup;
  return gulp.src(p)
    .pipe( C.dev ? watch(p)                         : noop() )
    .pipe( C.dev ? injectReload({ port: C.lrPort }) : noop() )
    .pipe(         gulp.dest('dist')                         )
    .pipe( C.dev ? livereload()                     : noop() );
});

gulp.task('karma', function(){
  karma.server.start({ configFile: require('path').resolve('./karma.conf.js') });
});

gulp.task('build', ['clean'], function(){
  gulp.start(['markup', 'scripts', 'styles' /*, 'copy'*/]);
});

gulp.task('default', function(){
  C.dev = true;
  livereload   = require('gulp-livereload');
  injectReload = require('gulp-inject-reload');
  watch        = require('gulp-watch');
  karma        = require('karma');

  livereload.listen({ port: C.lrPort });
  gulp.start([ 'webserver', /*'karma',*/ 'build' ]);
});
