import https from 'https';
import http2 from 'http2';
import { CertConfigOptions } from './interfaces';
import jsLogger from 'js-logger';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobClient, BlobServiceClient } from '@azure/storage-blob';

const log = jsLogger.get('zerossl-certrenewal-client');

export class ZeroSSLCertrenewalClient {

  private config: CertConfigOptions | null = null;

  private certificate = '';
  private privateKey = '';
  private ca = '';

  private httpsServer: https.Server | http2.Http2SecureServer | null = null;

  private renewalTimeout: any;

  /**
   * manages certs for node https server
   * @param httpsServer 
   * @param config 
   */
  public async manageZeroSSLCert(httpsServer: https.Server | http2.Http2SecureServer, config: CertConfigOptions): Promise<void> {
    log.info('start setup zeroSSL cert download');
    if(this.config == null) {
      this.initConfig(config);
    }
    this.httpsServer = httpsServer;

    if(!this.certificate) {
      await this.getCertificate();
    }

    this.setCertificate();

    this.updateCertificate();

    return;
  }

  /**
   * returns certificate, private key and ca.
   * http2 needs to have those during instantiation
   * @param config 
   * @returns 
   */
  public async getInitialZeroSSLCert(config: CertConfigOptions): Promise<[cert: string, key: string, ca: string]> {
    log.info('start setup zeroSSL cert download');
    this.initConfig(config);

    await this.getCertificate();

    return [
      this.certificate,
      this.privateKey,
      this.ca
    ];
  }

  public stopRenewal():void {
    log.info('stopRenewal: ' + this.config?.domainName);

    if(this.renewalTimeout) {
      clearTimeout(this.renewalTimeout);
    }
  }

  /**
   * sets certificate and updates after renewalInterval
   */
  private updateCertificate(): void {
    log.info('updateCertificate waiting...');

    this.renewalTimeout = setTimeout(() => {
      log.info('updateCertificate awake now: ' + this.config?.domainName);

      this.getCertificate().then(() => {
        this.setCertificate();
        this.updateCertificate();
      }).catch(e => { log.error(e); });
    }, this.config?.renewalInterval);
  }


  /**
   * sets certificate
   * @param httpsServer 
   * @param certifciate 
   * @param privateKey 
   */
  private setCertificate(): void {
    log.debug('set certificate: ' + this.certificate);
    if(!this.httpsServer) {
      throw new Error('httpsServer is not set');
    }

    this.httpsServer.setSecureContext({
      cert: this.certificate,
      key: this.privateKey,
      ca: this.ca
    });
  }

  /** does inits and ensures default values */
  private initConfig(config: CertConfigOptions): void {
    log.debug('init configuration: ', config);
    if(!config.renewalInterval) {
      // set default value, 7 days
      config.renewalInterval = 604800000;
    }
    
    if(process.env.NODE_ENV !== 'production' || config.logAll) {
      log.setLevel(jsLogger.TRACE);
      log.info('zeroSSLCertRnewalClient switched logger to log-level TRACE and applied own loggingFormatter');
    }

    this.config = config;
  }

  private async getCertificate(): Promise<void> {
    log.debug('start getting certificates for: ' + this.config?.domainName);

    if(this.config === null) {
      log.error('configuration for ZeroSSL renewal client not set');
      return;
    }

    // Enter your storage account name
    const defaultAzureCredential = new DefaultAzureCredential();
    
    const blobServiceClient = new BlobServiceClient(
      `https://${this.config.azureStorageAccountName}.blob.core.windows.net`,
      defaultAzureCredential
    );

    const containerClient = blobServiceClient.getContainerClient(this.config.azureStorageContainer);

    const cmdCert = containerClient.getBlobClient(`${this.config.domainName}/${this.config.domainName}.cer`);
    const cmdKey = containerClient.getBlobClient(`${this.config.domainName}/${this.config.domainName}.key`);
    const cmdCa = containerClient.getBlobClient(`${this.config.domainName}/ca.cer`);


    log.debug('get certificate: ', cmdCert);
    this.certificate = await this.streamToString(cmdCert) ?? '';

    log.debug('get private key: ', cmdKey);
    this.privateKey = await this.streamToString(cmdKey) ?? '';

    log.debug('get ca: ', cmdCa);
    this.ca = await this.streamToString(cmdCa) ?? '';

    return;
  }

  private async streamToString(blobClient: BlobClient): Promise<string | undefined> {
    const downloadBlockBlobResponse = await blobClient.download();
    if (downloadBlockBlobResponse.readableStreamBody) {
      const stream = downloadBlockBlobResponse.readableStreamBody;
      
      const result = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (data: any) => {
          chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        });
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        stream.on('error', reject);
      });
      return result.toString();
    }    
  }
}