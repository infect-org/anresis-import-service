import { Controller } from '@infect/rda-service';



export default class ImportController extends Controller {



    constructor({
        importFactory,
    }) {
        super('status');

        this.importFactory = importFactory;
        this.enableAction('create');
    }



    async create(request) {
        const data = await request.getData();

        if (!data) request.response().status(400).send(`Missing request body!`);
        else if (!type.object(data)) request.response().status(400).send(`Request body must be a json object!`);
        else if (!type.string(data.importName)) request.response().status(400).send(`Missing the parameter importName on the request body!`);
        else {
            const instance = this.importFactory.createImport(data.importName);

            const importId = await new Promise((resolve, reject) => {
                instance.on('id-create', resolve);
                instance.on('error', reject);
            });

            return { importId };
        }
    }
}
