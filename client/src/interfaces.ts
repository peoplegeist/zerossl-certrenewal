export interface CertConfigOptions {
  domainName: string,
  s3BucketName: string,
  s3BucketPrefix: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsDefaultRegion: string,
  renewalInterval?: number,
  logAll?: boolean
}