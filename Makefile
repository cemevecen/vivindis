# Vivindis — ortak komutlar (make install | make dev | make api)
.PHONY: install install-py install-js dev api build-web docker-up clean

PYTHON ?= python3
ROOT := $(abspath .)

install: install-py install-js

install-py:
	@test -d .venv || $(PYTHON) -m venv .venv
	.venv/bin/pip install -U pip
	.venv/bin/pip install -e ".[api]"

install-js:
	cd frontend && npm ci

dev:
	@./scripts/dev.sh

api:
	@./scripts/run_api.sh

build-web:
	cd frontend && npm run build

docker-up:
	docker compose up --build

clean:
	rm -rf frontend/node_modules frontend/dist
	find . -path ./.venv -prune -o -type d -name __pycache__ -print | xargs rm -rf 2>/dev/null || true
