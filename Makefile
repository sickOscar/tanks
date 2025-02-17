#!/usr/bin/make

SHELL = /bin/sh
UID := $(shell id -u)
GID := $(shell id -g)

export UID
export GID

dev:
	docker compose -f docker-compose.dev.yml up

build-dev:
	docker compose -f docker-compose.dev.yml build

down:
	docker compose -f docker-compose.dev.yml down

db:
	docker compose -f docker-compose.db.yml up

clear-db:
	@echo "Clearing database..."
	docker exec tanks-db-1 psql -U postgres -d postgres -c "drop table games cascade; drop table history cascade; drop table events cascade; drop table maps cascade; drop table votes cascade; drop table players cascade; drop table buildings cascade;"
	
