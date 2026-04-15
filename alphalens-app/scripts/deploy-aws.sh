#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AlphaLens PE — AWS Full-Stack Deploy Script
# Provisions: EC2 t3.small + RDS PostgreSQL t3.micro + S3 + CloudFront
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Docker installed locally
#   - jq installed (brew install jq / apt install jq)
#
# Usage: chmod +x scripts/deploy-aws.sh && ./scripts/deploy-aws.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config — edit these ───────────────────────────────────────────────────────
APP="alphalens-pe"
REGION="us-east-1"
INSTANCE_TYPE="t3.small"
KEY_PAIR_NAME="alphalens-key"
DB_INSTANCE="db.t3.micro"
DB_PASSWORD="$(openssl rand -hex 16)"
SECRET_KEY="$(openssl rand -hex 32)"
PROFILE="${AWS_PROFILE:-default}"

echo "=========================================="
echo "  AlphaLens PE — AWS Deployment"
echo "  Region: $REGION"
echo "=========================================="
echo ""

# ── 1. Create key pair ────────────────────────────────────────────────────────
echo "==> [1/8] Creating SSH key pair"
aws ec2 create-key-pair \
  --key-name $KEY_PAIR_NAME \
  --query 'KeyMaterial' --output text \
  --region $REGION --profile $PROFILE > ~/.ssh/${KEY_PAIR_NAME}.pem
chmod 600 ~/.ssh/${KEY_PAIR_NAME}.pem
echo "    Key saved to ~/.ssh/${KEY_PAIR_NAME}.pem"

# ── 2. Security groups ────────────────────────────────────────────────────────
echo "==> [2/8] Creating security groups"
SG_ID=$(aws ec2 create-security-group \
  --group-name "${APP}-sg" \
  --description "AlphaLens PE security group" \
  --region $REGION --profile $PROFILE \
  --query 'GroupId' --output text)

# Allow HTTP, HTTPS, SSH
for PORT in 22 80 443; do
  aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp --port $PORT --cidr 0.0.0.0/0 \
    --region $REGION --profile $PROFILE
done
echo "    Security group: $SG_ID"

# ── 3. Launch EC2 ─────────────────────────────────────────────────────────────
echo "==> [3/8] Launching EC2 instance ($INSTANCE_TYPE)"
# Amazon Linux 2023 AMI (us-east-1)
AMI_ID="ami-0c02fb55956c7d316"
USERDATA=$(base64 -w 0 << 'SCRIPT'
#!/bin/bash
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
SCRIPT
)

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_PAIR_NAME \
  --security-group-ids $SG_ID \
  --user-data "$USERDATA" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${APP}}]" \
  --region $REGION --profile $PROFILE \
  --query 'Instances[0].InstanceId' --output text)

echo "    Instance ID: $INSTANCE_ID"
echo "    Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION --profile $PROFILE
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text --region $REGION --profile $PROFILE)
echo "    Public IP: $PUBLIC_IP"

# ── 4. Create RDS PostgreSQL ──────────────────────────────────────────────────
echo "==> [4/8] Creating RDS PostgreSQL instance (this takes ~5 min)"
DB_SG_ID=$(aws ec2 create-security-group \
  --group-name "${APP}-db-sg" \
  --description "AlphaLens DB security group" \
  --region $REGION --profile $PROFILE \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress \
  --group-id $DB_SG_ID \
  --protocol tcp --port 5432 --source-group $SG_ID \
  --region $REGION --profile $PROFILE

DB_ENDPOINT=$(aws rds create-db-instance \
  --db-instance-identifier "${APP}-db" \
  --db-instance-class $DB_INSTANCE \
  --engine postgres --engine-version "16.1" \
  --master-username alphalens \
  --master-user-password "$DB_PASSWORD" \
  --db-name alphalens \
  --allocated-storage 20 \
  --vpc-security-group-ids $DB_SG_ID \
  --no-multi-az \
  --no-publicly-accessible \
  --region $REGION --profile $PROFILE \
  --query 'DBInstance.Endpoint.Address' --output text 2>/dev/null || echo "pending")

echo "    DB creating in background. Endpoint will be available in ~5 min."
echo "    DB Password: $DB_PASSWORD  ← SAVE THIS"

# ── 5. Build & push Docker images ─────────────────────────────────────────────
echo "==> [5/8] Building Docker images"
cd "$(dirname "$0")/.."

# Create ECR repos
for REPO in backend frontend; do
  aws ecr create-repository --repository-name "${APP}-${REPO}" \
    --region $REGION --profile $PROFILE 2>/dev/null || true
done

ACCOUNT=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
ECR="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

aws ecr get-login-password --region $REGION --profile $PROFILE | \
  docker login --username AWS --password-stdin $ECR

docker build -t "${ECR}/${APP}-backend:latest" ./backend
docker push "${ECR}/${APP}-backend:latest"

docker build -t "${ECR}/${APP}-frontend:latest" \
  --build-arg VITE_API_URL="http://${PUBLIC_IP}" ./frontend
docker push "${ECR}/${APP}-frontend:latest"
echo "    Images pushed to ECR"

# ── 6. Deploy to EC2 ─────────────────────────────────────────────────────────
echo "==> [6/8] Deploying to EC2 (waiting for SSH to be ready)"
sleep 30  # Wait for instance init

# Upload compose file and .env
DB_ENDPOINT_FINAL=$(aws rds wait db-instance-available \
  --db-instance-identifier "${APP}-db" \
  --region $REGION --profile $PROFILE 2>/dev/null && \
  aws rds describe-db-instances \
    --db-instance-identifier "${APP}-db" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text --region $REGION --profile $PROFILE)

cat > /tmp/alphalens-env << EOF
DB_PASSWORD=$DB_PASSWORD
SECRET_KEY=$SECRET_KEY
DATABASE_URL=postgresql+asyncpg://alphalens:${DB_PASSWORD}@${DB_ENDPOINT_FINAL}:5432/alphalens
CORS_ORIGINS=http://${PUBLIC_IP}
GITHUB_REPO=${APP}
EOF

scp -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no \
  /tmp/alphalens-env ec2-user@${PUBLIC_IP}:/opt/alphalens-pe/.env
scp -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no \
  docker-compose.prod.yml nginx/nginx.conf \
  ec2-user@${PUBLIC_IP}:/opt/alphalens-pe/

ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@${PUBLIC_IP} << REMOTE
  cd /opt/alphalens-pe
  aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d
REMOTE

# ── 7. Outputs ────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  ✅ AlphaLens PE Deployed Successfully"
echo "=========================================="
echo ""
echo "  🌐 App URL:    http://${PUBLIC_IP}"
echo "  🔑 SSH:        ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@${PUBLIC_IP}"
echo "  🐘 DB Host:    ${DB_ENDPOINT_FINAL:-<wait 5 min for RDS>}"
echo "  🔒 DB Pass:    ${DB_PASSWORD}"
echo "  🔑 Secret Key: ${SECRET_KEY}"
echo ""
echo "  Next: Point your domain's A record → ${PUBLIC_IP}"
echo "  Then run: certbot --nginx -d yourdomain.com (for HTTPS)"
echo ""
echo "  To re-deploy after code changes:"
echo "    docker build & push, then: docker compose pull && docker compose up -d"
