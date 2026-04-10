# Production Deployment Guide

## Overview

This document explains how the production deployment pipeline works, where Prisma migrations happen, and how alerts are sent on failure.

---

## Deployment Flow

### 1. GitHub Actions triggered on push to `main`

The `.github/workflows/deploy-prod.yml` workflow is triggered automatically on every push to the `main` branch.

**Steps:**
1. Checkout code
2. Set up Docker Buildx
3. Log in to Docker Hub
4. Build and push Docker image with tags:
   - `:latest` (most recent)
   - `:${{ github.sha }}` (commit SHA for traceability)
5. SSH to production EC2 and:
   - Write `.env` file from GitHub Secrets
   - Pull latest Docker image
   - Start containers with `docker compose up -d --no-deps app`

---

## Where Prisma Migrations Happen

### Build time (Dockerfile)
```dockerfile
RUN npx prisma generate --schema prisma/schema.prisma
```

- Only generates the Prisma client
- Does **not** run database migrations
- Safe because the build doesn't need a database connection

### Runtime (entrypoint.sh)
```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

- Runs **before** the NestJS app starts
- Uses `DATABASE_URL` from the `.env` file (populated by GitHub Action)
- Applies pending migrations atomically
- If migration fails, the container stops and sends a Slack alert

---

## Environment Variables Transfer

### Current Method: GitHub Action SSH

1. GitHub Actions stores all secrets in [Repository Secrets](https://github.com/settings/secrets/actions)
2. On deploy, the action SSHes into EC2 and writes `/home/ubuntu/florence-backend/.env`
3. `.env` file has strict permissions (`chmod 600`) — only readable by the owner
4. `docker-compose.prod.yml` uses `env_file: .env` to load variables into the container
5. NestJS app reads from `process.env.*`

**Secrets stored in GitHub:**
- `DATABASE_URL` — PostgreSQL RDS connection
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — Redis instance
- `JWT_SECRET_ACCESS_KEY`, `JWT_SECRET_REFRESH_KEY` — token signing
- `PAYSTACK_SECRET_KEY` — payment API
- `SMTP_PASSWORD` — email service
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — S3 uploads
- `SENTRY_DSN` — error tracking
- `SLACK_WEBHOOK_URL` — alerts
- And others...

### Future Improvement: AWS Secrets Manager / SSM Parameter Store

When ready, the deploy script can fetch secrets from AWS instead of GitHub Actions:

```bash
aws ssm get-parameters \
  --names /florence/prod/DATABASE_URL /florence/prod/JWT_SECRET_ACCESS_KEY \
  --with-decryption \
  --query 'Parameters[*].[Name,Value]' \
  --output text \
| awk '{ print $1 "=" $2 }' > .env
```

Then,` EC2 instance needs IAM role with `ssm:GetParameters` permission.

---

## Migration Failure Alerts

### How it works

The `entrypoint.sh` script now includes error handling:

1. Runs `npx prisma migrate deploy`
2. If successful → logs success timestamp and starts the app
3. If fails:
   - Logs the error with timestamp
   - Sends **Slack notification** with alert details (if `SLACK_WEBHOOK_URL` is set)
   - Exits container with error code (stops deployment)

### Slack Alert Format

When a migration fails, Slack receives:

```
🚨 PRODUCTION ALERT: Prisma Migration Failed

Service: florence-backend
Environment: production
Exit Code: 1
Timestamp: 2026-04-10T12:34:56Z
```

### What to do on migration failure

1. Check Slack notification for error code
2. SSH to EC2 and check last logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs app --tail=50
   ```
3. Check the migration file in `prisma/migrations/`
4. Fix the schema or migration
5. Push to `main` to trigger a re-deploy

---

## Docker Security

### Non-root user

The container now runs as the `node` user (created by Node.js alpine base image):

```dockerfile
RUN chown -R node:node /app
USER node
```

**Benefits:**
- No root privileges inside container
- Reduces attack surface
- If container is compromised, attacker has limited permissions

---

## File Permissions on EC2

```bash
# .env file created by GitHub Action
-rw------- (600)  .env

# Only readable by the ubuntu user (owner)
# github Actions runner has sudo, so it can create and write
# container runs as 'node' user inside, but reads from mounted .env
```

---

## Manual Testing / Local Override

### Dev environment

For local development, create your own `.env` file:

```bash
cp .env.example .env
# Edit .env with local values
docker compose -f docker-compose.dev.yml up
```

### Production testing

To test the production deploy locally (without pushing):

1. Create `.env` manually on EC2
2. SSH to EC2 and run:
   ```bash
   cd /home/ubuntu/florence-backend
   docker compose -f docker-compose.prod.yml pull app
   docker compose -f docker-compose.prod.yml up -d --no-deps app
   docker compose -f docker-compose.prod.yml logs app
   ```

---

## Rollback (if needed)

If a deployment goes wrong:

```bash
# SSH to EC2
ssh -i asiwaju-web-florence-dev.pem ubuntu@<PROD_EC2_HOST>

# View running containers
docker compose -f docker-compose.prod.yml ps

# Restart the previous image (if it's still cached)
docker compose -f docker-compose.prod.yml pull app:latest
docker compose -f docker-compose.prod.yml up -d --no-deps app

# Or run a specific SHA tag
docker compose -f docker-compose.prod.yml -f docker-compose.prod.yml down app
# Edit docker-compose.prod.yml to use a specific SHA, then up again
```

---

## Monitoring

### Real-time logs

```bash
# SSH to EC2
docker compose -f docker-compose.prod.yml logs -f app
```

### Check migrations

```bash
# Inside the container
docker compose -f docker-compose.prod.yml exec app npx prisma migrate status
```

### Container health

```bash
docker compose -f docker-compose.prod.yml ps
```

---

## Next Steps

### Immediate
- ✅ GitHub Secrets configured
- ✅ `.env` written securely via SSH
- ✅ Non-root user in Dockerfile
- ✅ Prisma migration failure alerts to Slack

### Medium-term (optional)
- Move secrets to AWS Secrets Manager or SSM Parameter Store
- Add semantic versioning to Docker tags (e.g., `v1.0.0`)
- Add database backup before migrations
- Set up CloudWatch / DataDog monitoring

---

## Troubleshooting

| Issue | Solution |
| --- | --- |
| Migration hangs | Check `DATABASE_URL`, verify RDS is accessible, check Prisma logs |
| `.env` not found on EC2 | Check GitHub workflow logs, verify SSH key permissions |
| Permission denied on `.env` | Files created by GitHub runner should be readable; check with `ls -la .env` |
| Docker image not pulled | Check `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets, verify Docker Hub credentials |
| Container exits immediately | Check logs: `docker compose logs app --tail=50` |
