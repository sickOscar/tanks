#!/usr/bin/make


PHONY: help

help: ## This help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

SHELL = /bin/sh
UID := $(shell id -u)
GID := $(shell id -g)

export UID
export GID

.PHONY: up
up: ## up and demonize
	docker compose -f docker-compose.dev.yml up -d

.PHONY: buildup
buildup: ## build up and demonize
	docker compose -f docker-compose.dev.yml up -d --build

.PHONY: down
down: ## tear down
	docker compose -f docker-compose.dev.yml down

.PHONY: db
db: ## start db
	docker compose -f docker-compose.db.yml up

.PHONY: clear-db
clear-db: ## clear db
	@echo "Clearing database..."
	docker exec tanks-db-1 psql -U postgres -d postgres -c "drop table games cascade; drop table history cascade; drop table events cascade; drop table maps cascade; drop table votes cascade; drop table players cascade; drop table buildings cascade;"
	
