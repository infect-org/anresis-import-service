import FileTransfer from '../src/FileTransfer.js';
import section from 'section-tests';
import assert from 'assert';
import ServiceManager from '@infect/rda-service-manager';
import RainbowConfig from '@rainbow-industries/rainbow-config';
import path from 'path';





section('FileTransfer', (section) => {
    let sm;

    section.setup(async() => {
        sm = new ServiceManager({
            args: '--dev.testing --log-level=error+ --log-module=*'.split(' ')
        });
        
        await sm.startServices('@infect/rda-service-registry');
        await sm.startServices('@infect/rda-lock-service');
    });



    section.test('load libraries', async() => {
        const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../config/');
        const config = new RainbowConfig(configDir, path.join(configDir, '../'));
        await config.load();

        const fileTransfer = new FileTransfer({
            config,
            importName: 'test', 
        });
        await fileTransfer.load();
        await fileTransfer.end();
    });



    section.test('get importable file', async() => {
        section.setTimeout(20000);
        const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../config/');
        const config = new RainbowConfig(configDir, path.join(configDir, '../'));
        await config.load();

        const fileTransfer = new FileTransfer({
            config,
            importName: 'test',
            testMode: true,
        });

        await fileTransfer.load();
        await fileTransfer.checkForData();
        await fileTransfer.end();
    });



    section.test('get file stream', async() => {
        section.setTimeout(20000);
        const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../config/');
        const config = new RainbowConfig(configDir, path.join(configDir, '../'));
        await config.load();

        const fileTransfer = new FileTransfer({
            config,
            importName: 'test', 
            testMode: true,
        });

        await fileTransfer.load();
        await fileTransfer.checkForData();
        assert.equal(fileTransfer.hasNewData(), true);

        const stream = fileTransfer.getStream();
        assert(stream);

        await fileTransfer.end();
    });


    section.test('get file chunk', async() => {
        section.setTimeout(20000);
        const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../config/');
        const config = new RainbowConfig(configDir, path.join(configDir, '../'));
        await config.load();

        const fileTransfer = new FileTransfer({
            config,
            importName: 'test', 
            testMode: true,
        });

        await fileTransfer.load();
        await fileTransfer.checkForData();
        assert.equal(fileTransfer.hasNewData(), true);

        const chunk = await fileTransfer.getChunk(100000);
        assert.equal(chunk.length, 19671);

        const finished = await fileTransfer.getChunk(100000);
        assert.equal(finished, null);

        await fileTransfer.end();
    });


    section.destroy(async() => {
        await sm.stopServices();
    });
});