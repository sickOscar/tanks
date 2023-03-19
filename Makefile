#!/usr/bin/make

SHELL = /bin/sh
UID := $(shell id -u)
GID := $(shell id -g)

export UID
export GID

dev:
	docker-compose -f docker-compose.dev.yml up

build-dev:
	docker-compose -f docker-compose.dev.yml build

down:
	docker-compose -f docker-compose.dev.yml down
