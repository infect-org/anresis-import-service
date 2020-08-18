import EventEmitter from 'events';
import InfectRDASampleImportClient from '@infect/infect-rda-sample-importer-client';
import logd from 'logd';
import parse from 'csv-parse';

import FileTransfer from './FileTransfer.js';
import Report from './Report.js';
import SendGridMailer from './SendGridMailer.js';


const log = logd.module('Import');



export default class Import extends EventEmitter {

    constructor({
        registryClient,
        config,
        importName,
        testMode = false,
    }) {
        if (!importName) throw new Error(`Missing parameter 'importName'!`);

        super();

        this.testMode = testMode;
        this.config = config;
        this.importName = importName;
        this.gcpConfig = this.config.get('gcp');

        this.mailer = new SendGridMailer({
            from: this.config.get('mailer.from'),
            apiKey: this.config.get('mailer.apiKey'),
            recipients: this.config.get('mailer.recipients'),
        });

        // used to buffer chunks of data that cannot be processed  yet
        this.buffer = '';
        this.registryClient = registryClient;
        this.importClient = new InfectRDASampleImportClient({
            registryClient,
        });


        this.threadCount = this.config.get('thread-count');
    }





    /**
     * start an import, gets the data from the anresis server, writes it to the google cloud
     * storage, reads it again from there and sends it to the infect rda importer
     */
    async import() {
        try {
            const dataSetName = this.config.get(`imports.${this.importName}.data-set-name`);
            const importIdentifier = `${dataSetName}-import-${new Date().toISOString()}`;
            const domain = this.config.get(`imports.${this.importName}.domain`);

            this.report = new Report({
                importName: this.importName,
                importIdentifier,
                domain,
            });

            log.info(`setting up file transfer`);
            this.transfer = new FileTransfer({
                config: this.config,
                importName: this.importName,
                testMode: this.testMode,
            });
            
            // get data from anresis, store it on gcp storage
            log.debug(`checking for new data`);
            await this.transfer.checkForData();

            // check if new data was detected, return if not
            if (this.transfer.hasNewData()) log.info(`new data found!`);
            else log.info(`no new data found`);

            if (!this.transfer.hasNewData()) return;


            log.info(`Creating new import for data set ${dataSetName} with the identifier ${importIdentifier} ...`);

            // create an import on the import agent
            await this.createImport({
                dataSetIdentifier: dataSetName,
                dataVersionIdentifier: importIdentifier,
                dataVersionDescription: `INFECT '${dataSetName}' data import executed on ${new Date().toISOString()}`,
            });


        
            await Promise.all(Array.apply(null, { length: this.threadCount }).map(async() => {
                while (true) {
                    log.debug(`getting data chunk ..`);
                    const chunk = await this.transfer.getChunk();

                    if (chunk === null) break;
                    log.debug(`got ${chunk.length} bytes of data`);

                    await this.processData(chunk);
                }
            }));
        } catch (err) {
            this.deleteImport();
            this.emit('end', err);
            this.emit('error', err);

            if (this.transfer) {
                await this.transfer.end();
            }

            throw err;
        }

        await this.commitImport();
        await this.transfer.end();

        this.emit('end');
    }





    /**
     * close the import, mark it as failed
     *
     */
    async deleteImport() {
        log.warn(`deleting import!`);
        
        if (this.transfer) {
            await this.transfer.cancelLock();
        }

        await this.importClient.delete();
    }



    /**
     * close the import, activate it so that rda can process it
     */
    async commitImport() {
        log.info(`Committing import!`);
        await this.importClient.commit();
        
        log.success(`Import was finished successfull!`);
        await this.mailer.sendReport(this.report);
    }



    /**
     * Creates an import so that the data can be sent to the 
     */
    async createImport({
        dataSetIdentifier,
        dataVersionIdentifier,
        dataVersionDescription,
    }) {
        await this.importClient.createImport({
            dataSetIdentifier,
            dataVersionIdentifier,
            dataVersionDescription,
        });

        this.importId = this.importClient.importId;
        this.emit('id-create', this.importId);
    }



    /**
     * store the lines on the import server
     *
     * @param      {array}   records   The records
     */
    async storeRecords(records) {
        log.debug(`sending ${records.length} rows to the import service ...`);

        records.forEach((record) => {
            if (record['patient-age-range-from'] && record['patient-age-range-from'].slice(-1).toLowerCase() !== 'y') {
                record['patient-age-range-from'] += 'y'; 
                record['patient-age-range-to'] += 'y';
            }
        });

        const report = await this.importClient.storeSamples(records);
        this.report.processResults(report);

        if (report.invalidSamples.length) {
            log.debug(`the import service rejected ${report.invalidSamples.length} rows due to invalidity ...`);
        }
        
        log.debug(`imported ${this.report.getTotalSampleCount()} records, rejected ${this.report.getInvalidSamplesCount()} records ...`);
    }   




    /**
     * process the data, send it to the infect rda importer
     *
     * @param      {buffer}   chunk   The chunk
     */
    async processData(chunk) {
        this.buffer += chunk.toString();

        // place complete lines in a separate string, leave the rest in the buffer
        let validLinesString = this.buffer.substring(0, this.buffer.lastIndexOf('\n')).trim();
        this.buffer = this.buffer.substring(this.buffer.lastIndexOf('\n'));

        if (validLinesString.length) {
            const records = await new Promise((resolve, reject) => {
                parse(validLinesString, {
                    columns: this.columns || true,
                }, (err, records) => {
                    if (err) reject(err);
                    else {
                        if (records.length) {
                            this.columns = Object.keys(records[0]);
                        }

                        resolve(records);
                    }
                });
            });
            

            // store on the importer
            await this.storeRecords(records);
        }
    }
}
