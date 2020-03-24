import logd from 'logd';
import Service from './index.js';


// set up the module logger
const log = logd.module('anresis-import-service');



// run the service
const service = new Service();


// load it
service.load().then(() => {
    log.success(`The anresis import service is listening on port ${service.server.port}`);
}).catch(log);

