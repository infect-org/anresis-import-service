import Import from '../src/Import.js';
import section from 'section-tests';
import assert from 'assert';
import ServiceManager from '@infect/rda-service-manager';
import RegistryClient from '@infect/rda-service-registry-client';
import RainbowConfig from '@rainbow-industries/rainbow-config';
import path from 'path';



section('Import', (section) => {
    let sm;

    section.setup(async() => {
        sm = new ServiceManager({
            args: '--dev.testing --log-level=error+ --log-module=* --data-for-dev'.split(' ')
        });
        
        await sm.startServices('@infect/rda-service-registry');
        await sm.startServices('@infect/rda-lock-service');
        await sm.startServices('@infect/infect-rda-sample-importer');
        await sm.startServices('@infect/infect-rda-sample-storage');
        await sm.startServices('@infect/api');
    });



    section.test('run import', async() => {
        section.setTimeout(10000000);

        const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../config/');
        const config = new RainbowConfig(configDir, path.join(configDir, '../'));
        await config.load();

        const registryClient = new RegistryClient(config.get('service-registry.host'));

        const importer = new Import({
            registryClient,
            config,
            importName: 'test', 
            testMode: true,
        });

        await importer.import();
    });


    section.destroy(async() => {
        await sm.stopServices();
    });
});