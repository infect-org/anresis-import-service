import SFTPClient from '@distributed-systems/sftp-client';
import LockClient from '@infect/rda-lock-client';
import path from 'path';
import GCP from '@google-cloud/storage';
import fs from 'fs';
import logd from 'logd';



const log = logd.module('FileTransfer');


export default class FielTransfer {


    constructor({
        config,
        importName,
    }) {
        if (!importName) throw new Error(`Missing parameter 'importName'!`);

        this.config = config;
        this.importName = importName;

        // indicates if the config and all client libraries were initialized
        this.isLoaded = false;
        this._needsImport = false;
        this.offset = 0;

        this.queue = [];
        this.maxThreads = 1;
        this.threadCount = 0;
    }




    async getChunk(size = this.config.get('gcp.chunk-size')) {
        setImmediate(() => {
            this.runGetChunk();
        });

        return new Promise((resolve, reject) => {
            this.queue.push({reject, resolve, size});
        });
    }



    runGetChunk() {
        if (this.threadCount < this.maxThreads && this.queue.length) {
            this.threadCount++;

            const { reject, resolve, size } = this.queue.shift();
            
            this.loadChunk(size).then(resolve).catch(reject).finally(() => {
                this.threadCount--;
                this.runGetChunk();
            });
        }
    }



    async loadChunk(size) {
        await this.load();

        log.debug(`loading ${size} bytes at offset ${this.offset} from file ${this.getFileName()} ...`);
        const stream = await this.getStream(this.getFileName(), this.offset, this.offset + size);
        let buffer = '';

        const noDataReturned = await new Promise((resolve, reject) => {
            stream.on('data', (chunk) => {
                this.offset += chunk.length;
                buffer += chunk.toString();
            });

            stream.on('error', reject);
            stream.on('finish', resolve);
        }).catch((err) => {
            if (err.message.includes('range not satisfiable')) return true;
            else throw err;
        });

        return noDataReturned ? null : buffer;
    }



    /**
     * returns a streaming object for a given file, returns the stream
     *
     * @param      {string}   fileName  The file name
     * @return     {Promise}  The s 3 stream.
     */
    async getStream(fileName = this.getFileName(), start, end) {
        await this.load();

        const bucket = this.s3Client.bucket(this.config.get('gcp.s3-bucket'));
        const file = bucket.file(fileName);

        const options = {};
        if (start) options.start = start;
        if (end) options.end = end;

        return file.createReadStream(options);
    }




    hasNewData() {
        return this._needsImport;
    }



    getFileName() {
        return this.s3FileName;
    }





    /**
     * checks if anresis has a new file, if yes, gets the file from anresis, 
     * stores it on gcp cloud storage and returns the filename as it's stored 
     * on the gcp storage. if the file was processed already, null is returned 
     * instead.
     */
    async checkForData() {
        await this.load();

        log.info(`checking for data ...`);

        // get a lock name, so that we'll able to know if we're currently already
        // processing the file in question
        const anresisFilePath = this.config.get(`imports.${this.importName}.sftp-server.file-path`);
        const stats = await this.sftpClient.stat(anresisFilePath);


        log.info(`source file has ${stats.size} bytes ..`);

        // get a clean filename
        const lockName = `anresis-import-${stats.size}-${stats.mtime}.csv`;
        const fileName = `anresis-import-${new Date().toISOString()}-${stats.size}-${stats.mtime}.csv`;

        // check if there is a lock for that file
        log.debug(`aquiring lock ...`);
        const exists = await this.lockClient.hasLock(lockName);

        if (!exists) {
            await this.lockClient.createLock(lockName, {
                keepAlive: false,
                ttl: this.config.get('lock-ttl'),
            });
            log.debug(`creating readstream for ${anresisFilePath} ...`);

            // aquire a readstream from the sftp server, pipe it into the gcp storage
            const readStream = await this.sftpClient.createReadStream(anresisFilePath);

            const bucket = this.s3Client.bucket(this.config.get('gcp.s3-bucket'));
            this.s3FileName = `${this.config.get('gcp.s3-prefix')}/${fileName}`;
            const file = bucket.file(this.s3FileName);

            log.debug(`creating write stream for ${this.s3FileName} ...`);

            const writeStream = file.createWriteStream({
                gzip: false,
                metadata: {
                    contentType: 'text/csv',
                },
            });
           
            await new Promise((resolve, reject) => {
                writeStream.on('error', (err) => {
                    log.error(`write stream filed!`, err);
                    reject(err);
                });

                writeStream.on('finish', () => {
                    log.info(`write stream finished!`);
                    resolve();
                });

                readStream.pipe(writeStream);
            });

            this._needsImport = true;
        }
    }





    async end() {
        this.sftpClient.end();
    }


    /**
     * prepare all required functionality for any transactions with s3
     */
    async load() {
        if (!this.isLoaded) {
            log.info(`loading module`);
            await this.connectSFTP();
            await this.loadS3Client();
            await this.loadLockClient();
        }

        this.isLoaded = true;
    }




    async loadLockClient() {
        log.debug(`loading lock client`);
        this.lockClient = new LockClient({
            serviceRegistryHost: this.config.get('service-registry.host'),
        });
    }




    async loadS3Client() {
        log.debug(`loading s3 client`);
        this.s3Client = new GCP.Storage({
            credentials: this.config.get('gcp'),
        });
    }




    async connectSFTP() {
        log.debug(`conencting to sftp server ${this.config.get(`imports.${this.importName}.sftp-server.hostname`)}`);
        this.sftpClient = new SFTPClient();

        await this.sftpClient.connect(this.config.get(`imports.${this.importName}.sftp-server`));
    }
}