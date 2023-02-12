dev:
	UID=${UID} GID=${GID} docker-compose -f docker-compose.dev.yml up

build-dev:
	docker-compose -f docker-compose.dev.yml build

down:
	docker-compose -f docker-compose.dev.yml down