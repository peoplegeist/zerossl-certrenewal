# Intro zerossl-certrenewal
Issues/renews zerossl-certs (tls/ssl) for https/2-node cluster servers behind a load balancer.
It has been designed for AWS ECS Cluster use but feel free to fork it and extend it for other cloud providers.
It uses:
- S3 to store certs and zerossl-account information
- route53 for dns challenge
- ECS task scheduler to schedule period cert renewal

This is under development.

I will tag it v1 once it works.

# Overview
Part 1 - Renewal bot: 'zerossl-certrenewal-bot'
- launched periodically as a docker task or run it 24/7
- Using route53 DNS challenge, the docker task will renew certs that expire soon or issue a new cert.
- Uploads the new certs to S3 (if there is a new certificate)


Part 2 - Check and install new cert: 'zerossl-certrenewal-client'
- Checks during bootup of node/http2 server if there is a new cert on S3
- Periodically checks S3 for a new certs and installs it
- If no S3 source is configured, a local cert can be supplied

# Installation Part 1: Renewal bot (docker)
## Build zerossl-certrenewal-bot docker image
- Clone github repository
- cd ./bot
- docker build -t zerossl-certrenewal-bot ./
## Prepare AWS & ZeroSSL
- Create a zerossl-account if you don't have one yet
- Create S3 bucket
- Created hosted zone in route53 if it does not exist yet
- Create IAM policy and attach to a role/user with these permissions (watch out for the *** comments):

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "route53:GetChange",
                "route53:ChangeResourceRecordSets",
                "route53:ListResourceRecordSets"
            ],
            "Resource": [
                "arn:aws:route53:::hostedzone/***zoneid***",
                "arn:aws:route53:::change/***zoneid***"
            ]
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "route53:ListHostedZones",
                "route53:ListHostedZonesByName"
            ],
            "Resource": "*"
        },
        {
            "Sid": "VisualEditor2",
            "Effect": "Allow",
            "Action": "s3:*",
            "Resource": "***limit-to-target-s3*bucket***"
        }
    ]
}
```

## Run zerossl-certrenewal-bot
docker run peoplegeist/zerossl-certrenewal-bot

Setup a periodic docker task with these ENVIRONMENT variables
- ZEROSSL_EMAIL: ZeroSSL account email
- CERT_DOMAIN: fully qualified hostname of the certificate e.g. 'backend-api.yourdomain.com'
- AWS_ACCESS_KEY_ID: of the role that has access to route53 and S3 (see above)
- AWS_SECRET_ACCESS_KEY
- S3_BUCKET_URL: The bucket where to store ZeroSSL config and certs e.g. s3://buildchain-assets.yourdomain.com/prod/certs

# Installation Part 2: Renewal client (nodejs library)
## Install library

npm install zerossl-certrenewal-client

## Adjust https server (see below for http2 server)

```
    httpsServer = https.createServer(requestListener);

    const zeroSSLCertClient = new ZeroSSLCertrenewalClient();

    await zeroSSLCertClient.manageZeroSSLCert(httpsServer, certConfig);    
    httpsServer.listen(8443);
    ....

```

Shutdown of app
```
    zeroSSLCertClient.stopRenewal();
```

## Adjust http2 server 

```
    const zeroSSLCertClient = new ZeroSSLCertrenewalClient();
    
    zeroSSLCertClient.getInitialZeroSSLCert(certConfig).then((certArray) => {
      http2Server = http2.createSecureServer({
        cert: certArray[0],
        key: certArray[1],
        ca: certArray[2],
        allowHTTP1: true
      }, requestListener);

      http2Server.listen(9443);

      zeroSSLCertClient.manageZeroSSLCert(httpsServer, certConfig).then(() => {
      ....

```

Shutdown of app
```
    zeroSSLCertClient.stopRenewal();
```

## Configura certConfig

```
const certConfig: CertConfigOptions = {
    domainName: domain-name of the certificate,
    s3BucketName: s3 bucket name (without prefix),
    s3BucketPrefix: s3 prefix to the cert or folder name,
    awsAccessKeyId: Role with S3 read access to the bucket,
    awsSecretAccessKey: '',
    awsDefaultRegion: aws-region,
    renewalInterval?: in ms (default 7 days),
    logAll?: default false
};

```

Example:
zerossl-certrenewal-bot:
- S3_BUCKET_URL = s3://buildchain-assets.yourdomain.com/prod/certs
zerossl-certrenewal-client:
- S3_BUCKET_NAME = buildchain-assets.yourdomain.com
- S3_BUCKET_PREFIX =  prod/certs

```
  const certConfig: CertConfigOptions = {
    domainName: 'test-api.yourdomain.com',
    s3BucketName: 'buildchain-assets.yourdomain.com',
    s3BucketPrefix: 'prod/certs',
    awsAccessKeyId: 'FDSFDSFDS',
    awsSecretAccessKey: 'XFDSFDSFDSf',
    awsDefaultRegion: 'eu-west-1'
  };
```