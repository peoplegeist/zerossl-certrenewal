import jsLogger from 'js-logger';
import https from 'https';
import http2 from 'http2';
import { ZeroSSLCertrenewalClient } from './';
import { CertConfigOptions } from './interfaces';
import dotenv from 'dotenv';

jsLogger.useDefaults({
  defaultLevel: jsLogger.TRACE
});
const log = jsLogger.get('indexTest');

dotenv.config();

describe('index', () => {

  const certConfig: CertConfigOptions = {
    domainName: '',
    azureStorageAccountName: '',
    azureStorageContainer: '',
    azureClientId: '',
    azureClientSecret: '',
    azureTenantId: '',
    renewalInterval: 1000,
    logAll: true
  };
  
  let httpsServer: https.Server;
  let http2Server: http2.Http2SecureServer;
  
  beforeAll(() => {
    if(process.env.CERT_DOMAIN === undefined) {
      throw new Error('env not configured');
    }
    certConfig.domainName = process.env.CERT_DOMAIN!;
    certConfig.azureClientId = process.env.AZURE_CLIENT_ID!;
    certConfig.azureClientSecret = process.env.AZURE_CLIENT_SECRET!;
    certConfig.azureTenantId = process.env.AZURE_TENANT_ID!;
    certConfig.azureStorageAccountName = process.env.STORAGE_ACCOUNT_NAME!;
    certConfig.azureStorageContainer = process.env.STORAGE_COUNTAINER!;
  });

  afterAll(() => {
    if(httpsServer) {
      httpsServer.closeAllConnections();
      httpsServer.close();
    }

    if(http2Server) {
      http2Server.close();
    }
  });

  test('https', (done) => {

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const requestListener = function (req: any, res: any) {
      res.writeHead(200);
      res.end('Hello, World!');
    };
    
    httpsServer = https.createServer(requestListener);

    const zeroSSLCertClient = new ZeroSSLCertrenewalClient();

    zeroSSLCertClient.manageZeroSSLCert(httpsServer, certConfig).then(() => {
      httpsServer.listen(8443);

      https.get('https://127.0.0.1:8443/', { rejectUnauthorized: false }, (res) => {
        log.debug('statusCode:', res.statusCode);
        log.debug('headers:', res.headers);

        expect(res.statusCode).toBe(200);
        done();

        zeroSSLCertClient.stopRenewal();

      }).on('error', (e) => {
        log.error(e);
        expect(e).toBe(null);
        done();
      });

    }).catch(e => { log.error(e); });

    return;

  });

  test('http2-init', (done) => {

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const requestListener = function (req: any, res: any) {
      res.writeHead(200);
      res.end('Hello, World!');
    };
    
    const zeroSSLCertClient = new ZeroSSLCertrenewalClient();
    
    zeroSSLCertClient.getInitialZeroSSLCert(certConfig).then((certArray) => {
      http2Server = http2.createSecureServer({
        cert: certArray[0],
        key: certArray[1],
        ca: certArray[2],
        allowHTTP1: true
      }, requestListener);

      http2Server.listen(9443);

      zeroSSLCertClient.manageZeroSSLCert(http2Server, certConfig).then(() => {
      
        https.get('https://127.0.0.1:9443/', { rejectUnauthorized: false, ciphers: 'ALL' }, (res) => {
          log.debug('statusCode:', res.statusCode);
          log.debug('headers:', res.headers);

          expect(res.statusCode).toBe(200);
          zeroSSLCertClient.stopRenewal();
          http2Server.close();
          res.destroy();
          done();

          

        }).on('error', (e) => {
          log.error(e);
          expect(e).toBe(null);
          done();
        });
    
      }).catch(e => { log.error(e); });

    }).catch(e => { log.error(e); });

    return;

  });

});