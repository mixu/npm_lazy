TESTS += test/api.test.js
TESTS += test/cache.test.js
TESTS += test/lifecycle.test.js
TESTS += test/package.test.js

test:
	@sudo -E ./node_modules/.bin/mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)

.PHONY: test
