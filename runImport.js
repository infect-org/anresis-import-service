import Service from './src/Service.js';
import logd from 'logd';
import ConsoleTransport from 'logd-console-transport';



// enable console logging
logd.transport(new ConsoleTransport());

// set up the module logger
const log = logd.module('anresis-import-service');

// run the service
const service = new Service();


// load it
service.load().then(async () => {
    log.success(`The anresis import service is listening on port ${service.server.port}`);
    
    await service.runImport(process.argv.includes('--vet') ? 'anresis-vet': 'anresis-human');

    setImmediate(() => {
        process.exit();
    });
}).catch((err) => {
    log.error(err);
    setImmediate(() => {
        process.exit();
    });
});

