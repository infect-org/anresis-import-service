import { Controller } from '@infect/rda-service';



export default class StatusController extends Controller {



    constructor({
        importFactory,
    }) {
        super('status');

        this.importFactory = importFactory;
        this.enableAction('list');
    }



    async list(request) {
        request.reponse().send({ status: 'ok' });
    }
}
