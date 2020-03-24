import Import from './Import.js';


export default class ImportFactory {

    
    constructor({
        registryClient,
        config,
    }) {
        this.config = config;
        this.registryClient = registryClient;

        this.imports = new Map();
    }



    createImport(importName) {
        if (this.imports.has(importName)) {
            throw new Error(`Cannot create Import ${importName}. Import is already running!`);
        }

        const instance = new Import({
            registryClient,
            config,
            importName,
        });

        this.imports.set(importName, import);

        instance.on('end', () => {
            this.imports.delete(importName);
        });

        setImmediate(() => {
            instance.import();
        });
        

        return instance;
    }
}