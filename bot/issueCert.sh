#!/bin/bash

# ENV Variables
# ZEROSSL_EMAIL: ZeroSSL account email
# CERT_DOMAIN: fully qualified hostname of the certificate e.g. 'backend-api.yourdomain.com'
# AZURE_CLIENT_ID: of the role that has access to route53 and S3 (see above)
# AZURE_CLIENT_SECRET
# AZURE_TENANT_ID
# AZ_STORAGE_CONTAINER: The container where to store ZeroSSL config and certs e.g. certs
# AZ_STORAGE_ACCOUNT_NAME: 

# az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID

echo "restore acme.sh home"

if [ -d "~/.acme.sh" ]; then
  rm -rf ~/.acme.sh/*
else
  mkdir -p ~/.acme.sh
fi
# Equivalent for Azure Blob Storage
az storage blob download-batch --destination ~/.acme.sh --source $AZ_STORAGE_CONTAINER --pattern ".acme.sh/*" --account-name $AZ_STORAGE_ACCOUNT_NAME

echo "Update acme.sh"
./acme.sh --upgrade

echo "Login to ZERO SSL Account"
./acme.sh --register-account -m $ZEROSSL_EMAIL

echo "Get cert"
./acme.sh --issue -d $CERT_DOMAIN --dns dns_aws

if [ $? -eq 2 ]
then
  echo "Cert not issued, no need to copy to ssl"
else
  echo "Upload new cert to AZ Storage"

  az storage blob upload-batch --destination $AZ_STORAGE_CONTAINER/$CERT_DOMAIN --source ~/.acme.sh/${CERT_DOMAIN}_ecc --account-name $AZ_STORAGE_ACCOUNT_NAME --overwrite

  # aws s3 cp  --recursive ~/.acme.sh/$CERT_DOMAIN $S3_BUCKET_URL/$CERT_DOMAIN
fi

echo "backup acme.sh home"
az storage blob upload-batch --destination $AZ_STORAGE_CONTAINER/.acme.sh --source ~/.acme.sh --account-name $AZ_STORAGE_ACCOUNT_NAME --overwrite
# aws s3 sync ~/.acme.sh $S3_BUCKET_URL/.acme.sh --delete

echo "find your certs at: $AZ_STORAGE_CONTAINER/$CERT_DOMAIN" 
