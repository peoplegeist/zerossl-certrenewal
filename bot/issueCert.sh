#!/bin/bash

# ENV Variables
# ZEROSSL_EMAIL: ZeroSSL account email
# CERT_DOMAIN: fully qualified hostname of the certificate e.g. 'backend-api.yourdomain.com'
# AWS_ACCESS_KEY_ID: of the role that has access to route53 and S3 (see above)
# AWS_SECRET_ACCESS_KEY
# S3_BUCKET_URL: The bucket where to store ZeroSSL config and certs e.g. s3://buildchain-assets.yourdomain.com/prod/certs

echo "restore acme.sh home"
aws s3 sync $S3_BUCKET_URL/.acme.sh ~/.acme.sh --delete

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
  echo "Upload new cert to S3"
  aws s3 cp  --recursive ~/.acme.sh/$CERT_DOMAIN $S3_BUCKET_URL/$CERT_DOMAIN
fi

echo "backup acme.sh home"
aws s3 sync ~/.acme.sh $S3_BUCKET_URL/.acme.sh --delete

echo "find your certs at: $S3_BUCKET_URL/$CERT_DOMAIN" 
