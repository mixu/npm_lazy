TESTS += test/server.test.js

test:
	@sudo -E ./node_modules/.bin/mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)

.PHONY: test
