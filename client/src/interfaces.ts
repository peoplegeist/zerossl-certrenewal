export interface CertConfigOptions {
  domainName: string,
  azureStorageAccountName: string,
  azureStorageContainer: string,
  azureClientId: string,
  azureClientSecret: string,
  azureTenantId: string,
  renewalInterval?: number,
  logAll?: boolean
}
