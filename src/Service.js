import RDAService from '@infect/rda-service';
import path from 'path';
import logd from 'logd';
import Import from './Import.js';

import StatusController from './controller/Status.js';

const log = logd.module('anresis-import-service');
const appRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '../');




export default class AnresisImportService extends RDAService {


    constructor() {
        super({
            name: 'anresis-import-service',
            appRoot,
        });
    }




    async runImport(importName) {
        const importer = new Import({
            registryClient: this.registryClient,
            config: this.config,
            importName,
        });

        await importer.import();
    }




    /**
    * prepare the service
    */
    async load() {
        await this.initialize();

        const options = {};

        // register controllers
        this.registerController(new StatusController(options));


        await super.load();

        // tell the service registry where we are
        await this.registerService();
    }
}