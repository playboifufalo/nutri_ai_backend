.PHONY: help build up down restart logs shell test clean dev prod
default target
help:
	@echo "Available commands:"
	@echo "  build     - Build Docker images"
	@echo "  dev       - Start development environment"
	@echo "  prod      - Start production environment"
	@echo "  up        - Start services (development)"
	@echo "  down      - Stop services"
	@echo "  restart   - Restart services"
	@echo "  logs      - Show logs"
	@echo "  shell     - Open shell in backend container"
	@echo "  test      - Run tests"
	@echo "  clean     - Clean up containers and volumes"

#build Docker images
build:
	docker-compose build

#development environment
dev:
	docker-compose -f docker-compose.dev.yml up --build

#production environment
prod:
	docker-compose up --build -d

#start services (development)
up:
	docker-compose -f docker-compose.dev.yml up

#stop services
down:
	docker-compose down

#restart services
restart:
	docker-compose restart

#show logs
logs:
	docker-compose logs -f

#open shell in backend container
shell:
	docker-compose exec nutri-ai-backend bash

#run tests
test:
	docker-compose exec nutri-ai-backend python -m pytest

#clean up
clean:
	docker-compose down -v
	docker system prune -f
	docker volume prune -f

#database migration
migrate:
	docker-compose exec nutri-ai-backend python -c "from app.models.database import init_db; init_db()"

#create directories
setup:
	mkdir -p data uploads logs nginx/ssl