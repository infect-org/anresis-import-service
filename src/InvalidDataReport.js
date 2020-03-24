

export default class InvalidDataReport {



    createReport(invalidData) {
        const invalidProperties = new Map();

        for (const row of invalidData) {
            for (const failedValidation of row.failedValidationData) {
                if (!invalidProperties.has(failedValidation.inputName)) {
                    invalidProperties.set(failedValidation.inputName, {
                        outputName: failedValidation.outputName,
                        values: new Map(),
                    })
                }

                const validation = invalidProperties.get(failedValidation.inputName);

                if (!validation.values.has(failedValidation.inputValue)) {
                    validation.values.set(failedValidation.inputValue, []);
                }

                validation.values.get(failedValidation.inputValue).push(failedValidation.type);
            }
        }

        return invalidProperties;
    }
}