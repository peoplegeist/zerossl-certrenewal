import https from 'https';
import http2 from 'http2';
import { CertConfigOptions } from './interfaces';
import jsLogger from 'js-logger';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

const log = jsLogger.get('zerossl-certrenwal-client');

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

    const loggingFormatter = function(messages: string[], context: any) {
      // prefix each log message with a timestamp.
      messages.unshift('['+context.name+']');
      messages.unshift(context.level.name);
    };
    
    if(process.env.NODE_ENV === 'production' && config.logAll === false) {
      jsLogger.useDefaults({
        defaultLevel: jsLogger.INFO,
        formatter: loggingFormatter
      });
    } else {
      jsLogger.useDefaults({
        defaultLevel: jsLogger.TRACE,
        formatter: loggingFormatter
      });

    }

    this.config = config;
  }

  private async getCertificate(): Promise<void> {
    log.debug('start getting certificates for: ' + this.config?.domainName ?? '-no config-');

    if(this.config === null) {
      log.error('configuration for ZeroSSL renewal client not set');
      return;
    }
    const s3 = new S3Client({ 
      region: this.config.awsDefaultRegion,
      credentials: {
        accessKeyId: this.config.awsAccessKeyId,
        secretAccessKey: this.config.awsSecretAccessKey
      }
    });

    const command = new ListObjectsV2Command({
      Bucket: this.config.s3BucketName,
      Prefix: this.config.s3BucketPrefix + '/' + this.config.domainName + '/'
    });
    const list = await s3.send(command);
    log.debug('certificate path content: ', list);
    if(!list.Contents || list.Contents.length == 0) {
      log.error('no certificates found');
      throw new Error('no certificate found at: ' + this.config.s3BucketName + ' for domain ' + this.config.domainName);
    }

    const cmdCert = new GetObjectCommand({
      Bucket: this.config.s3BucketName,
      Key: this.config.s3BucketPrefix + '/' + this.config.domainName + '/' + this.config.domainName + '.cer'
    });

    const cmdKey = new GetObjectCommand({
      Bucket: this.config.s3BucketName,
      Key: this.config.s3BucketPrefix + '/' + this.config.domainName + '/' + this.config.domainName + '.key'
    });

    const cmdCa = new GetObjectCommand({
      Bucket: this.config.s3BucketName,
      Key: this.config.s3BucketPrefix + '/' + this.config.domainName + '/ca.cer'
    });

    log.debug('get certificate: ', cmdCert);
    const cert = await s3.send(cmdCert);
    this.certificate = await this.streamToString(cert.Body);

    log.debug('get private key: ', cmdKey);
    const key = await s3.send(cmdKey);
    this.privateKey = await this.streamToString(key.Body);

    log.debug('get ca: ', cmdCa);
    const ca = await s3.send(cmdCa);
    this.ca = await this.streamToString(ca.Body);

    return;
  }

  private streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }
}