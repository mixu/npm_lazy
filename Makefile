TESTS += test/api.test.js
TESTS += test/cache.test.js
TESTS += test/lifecycle.test.js
TESTS += test/package.test.js

test:
	# Why /usr/bin/env? Because I want stuff like nvm versions to take precedence
	/usr/bin/env node ./node_modules/.bin/mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)

lint:
	jshint . --exclude="**/node_modules"
	# fixjsstyle --nojsdoc --jslint_error=all --disable=6 --max_line_length=120 --exclude_directories=node_modules -r .
	gjslint --nojsdoc --jslint_error=all --disable=6 --max_line_length=120 --exclude_directories=node_modules -r .

.PHONY: test lint
