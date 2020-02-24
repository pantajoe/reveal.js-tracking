module.exports = grunt => {

  require('load-grunt-tasks')(grunt);

  let port = grunt.option('port') || 8000;
  let root = grunt.option('root') || '.';

  if (!Array.isArray(root)) root = [root];

  // Project configuration
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner:
        '/*!\n' +
        ' * reveal.js-tracking <%= pkg.version %> (<%= grunt.template.today("yyyy-mm-dd, HH:MM") %>)\n' +
        ' * MIT licensed\n' +
        ' *\n' +
        ' * Copyright (C) 2020 Joe Pantazidis\n' +
        ' */'
    },

    connect: {
      server: {
        options: {
          port: port,
          base: root,
          livereload: true,
          open: true,
          useAvailablePort: true
        }
      }
    },

    zip: {
      bundle: {
        src: [
          'index.html',
          'css/**',
          'js/**',
          'demo/**',
          'plugin/**',
          '**.md'
        ],
        dest: 'reveal-js-tracking.zip'
      }
    },

    watch: {
      js: {
        files: ['gruntfile.js', 'js/tracking.js']
      },
      css: {
        files: ['css/tracking.css']
      },
      html: {
        files: root.map(path => path + '/*.html')
      },
      markdown: {
        files: root.map(path => path + '/*.md')
      },
      options: {
        livereload: true
      }
    }
  });

  // Default task
  grunt.registerTask('default', ['css', 'js']);

  // JS task
	grunt.registerTask('js', ['uglify']);

  // CSS task
	grunt.registerTask('css', ['autoprefixer', 'cssmin']);

  // Package presentation to archive
  grunt.registerTask('package', ['default', 'zip']);

  // Serve presentation locally
  grunt.registerTask('serve', ['connect', 'watch']);
};
