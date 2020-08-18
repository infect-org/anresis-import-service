import logd from 'logd';
import crypto from 'crypto';

const log = logd.module('report');




export default class Report {

    constructor({
        importName,
        importIdentifier,
        domain,
    }) {
        this.domain = domain;
        this.importIdentifier = importIdentifier;
        this.importName = importName;
        this.microorganisms = new Map();
        this.compounds = new Map();
        this.matrix = new Map();

        this.validationErrors = new Map();
        this.errors = new Map();

        this.invalidSampleCount = 0;
        this.validSampleCount = 0;
        this.duplicateRecordCount = 0;
        this.importedRecordCount = 0;

        const secret = '-aw9e8rhasd';
        this.token = crypto.createHash('sha256')
            .update(`${this.importIdentifier}${secret}`)
            .digest('hex');
    }



    getSubjectLine() {
        return `INFECT Import report for ${this.importName} - ${new Date().toISOString()}`;
    }


    getHTMLReport() {
        const totalSampleCount = this.getTotalSampleCount();
        const invalidSampleCount = this.getInvalidSamplesCount();

        let msg = `<h1>${this.getSubjectLine()}</h1>`;

        msg += `<strong>Tenant</strong>: ${this.importName}<br />`;
        msg += `<strong>Date</strong>: ${new Date().toISOString()}<br />`;
        msg += `<strong>Total processed samples</strong>: ${totalSampleCount}<br />`;
        msg += `<strong>Invalid samples</strong>: ${invalidSampleCount} (${Math.round(invalidSampleCount/totalSampleCount*100*100)/100}%)<br />`;
        msg += `<strong>Not imported samples (duplicates)</strong>: ${this.duplicateRecordCount} (${Math.round((this.duplicateRecordCount-invalidSampleCount)/totalSampleCount*100*100)/100}%)<br />`;
        msg += `<strong>Total imported samples</strong>: ${this.importedRecordCount} (${Math.round(this.importedRecordCount/totalSampleCount*100*100)/100}%)<br /><br />`;

        msg += `<p>The newly imported data is avilable from tomorrow on, then you may the links below to view and check the new data.</p>`;

        msg += `<a clicktracking=off href="https://${this.domain}?dataVersionStatusIdentifiers=active" target="_blank">INFECT ${this.importName} - existing data only</a><br />`;
        msg += `<a clicktracking=off href="https://${this.domain}?dataVersionStatusIdentifiers=preview" target="_blank">INFECT ${this.importName} - new imported data only</a><br />`;
        msg += `<a clicktracking=off href="https://${this.domain}?dataVersionStatusIdentifiers=active,preview" target="_blank">INFECT ${this.importName} - all data (existing and newly improted)</a><br /><br />`;

        msg += `<h3>Publish Data</h3>`;
        msg += `<p>Be aware, that the data imported is not visible before tomorrows, so you should not publish or unpublish it before you have checked it with the links above! If you decide NOT to publish the data of this import, all samples that were imported by this import will never be published since imports after this one will not re-import samples that were improted by this import! If you want to preevent this behaviour, you need to delete this import using the link below! </p>`;

        msg += `<a clicktracking=off href="https://api.${this.domain}/rda/v2/rda.dataVersionStatus?identifier=${this.importIdentifier}&token=${this.token}&action=activate" target="_blank">INFECT ${this.importName} - publish newly imported data</a><br />`;
        msg += `<a clicktracking=off href="https://api.${this.domain}/rda/v2/rda.dataVersionStatus?identifier=${this.importIdentifier}&token=${this.token}&action=deactivate" target="_blank">INFECT ${this.importName} - unpublish newly imported data</a><br />`;
        msg += `<a clicktracking=off href="https://api.${this.domain}/rda/v2/rda.dataVersionStatus?identifier=${this.importIdentifier}&token=${this.token}&action=delete" target="_blank">INFECT ${this.importName} - delete the newly imported data</a><br /><br />`;


        if (this.errors.size) {
            msg += `<h2>Mapping problems</h2>`;

            for (const [problem, types] of this.errors.entries()) {
                msg += `<h3>${problem}</h3>`;

                for (const [inputName, valueMap] of types.entries()) {
                    msg += `<strong>Field ${inputName}</strong><br /><ul>`;

                    for (const [value, N] of valueMap.entries()) {
                        msg += `<li>Value: ${value}, ${N}</li>`;
                    }

                    msg += '</ul>';
                }
            }
        }

        if (this.validationErrors.size) {
            msg += `<h2>Other problems</h2><ul>`;

            for (const [message, N] of this.validationErrors.entries()) {
                msg += `<li>${message}: ${N}</li>`;
            }

            msg += '</ul>';
        }


        if (this.microorganisms.size) {
            msg += `<h2>Valid microorganisms</h2><ul>`;

            for (const [name, N] of this.microorganisms.entries()) {
                msg += `<li><strong>${name}</strong>: ${N}</li>`;
            }

            msg += '</ul>';
        }


        if (this.compounds.size) {
            msg += `<h2>Valid substances</h2><ul>`;

            for (const [name, N] of this.compounds.entries()) {
                msg += `<li><strong>${name}</strong>: ${N}</li>`;
            }

            msg += '</ul>';
        }

/*
        if (this.matrix.size) {
            msg += `<h2>Matrix Points</h2><ul>`;

            for (const [microorganism, substances] of this.matrix.entries()) {
                for (const [substance, N] of substances.entries()) {
                    msg += `<li><strong>${microorganism} - ${substance}</strong>: ${N}</li>`;
                }
            }

            msg += '</ul>';
        }
*/

        return msg;
    }


    getInvalidSamplesCount() {
        return this.invalidSampleCount;
    }


    getTotalSampleCount() {
        return this.validSampleCount;
    }



    processResults({
        importedRecordCount,
        duplicateRecordCount,
        totalRecordCount,
        invalidSamples,
        validSamples,
    }) {
        this.importedRecordCount += importedRecordCount;
        this.duplicateRecordCount += duplicateRecordCount;

        if (invalidSamples && invalidSamples.length) {
            this.invalidSampleCount += invalidSamples.length;

            for (const sample of invalidSamples) {
                for (const failure of sample.failedValidationData) {
                    if (!this.errors.has(failure.type)) {
                        this.errors.set(failure.type, new Map());
                    }
                    const map = this.errors.get(failure.type);

                    if (!map.has(failure.inputName)) {
                        map.set(failure.inputName, new Map());
                    }

                    const itemMap = map.get(failure.inputName);

                    if (!itemMap.has(failure.inputValue)) {
                        itemMap.set(failure.inputValue, 0);
                    }
                    itemMap.set(failure.inputValue, itemMap.get(failure.inputValue) + 1);
                }

                for (const message of sample.validationErrors) {
                    if (!this.validationErrors.has(message)) {
                        this.validationErrors.set(message, 0);
                    }
                    this.validationErrors.set(message, this.validationErrors.get(message) + 1);
                }
            }
        }


        if (validSamples && validSamples.length) {
            this.validSampleCount += validSamples.length;

            for (const sample of validSamples) {
                const microorganism = sample.originalValues.microorganism;
                const compound = sample.originalValues.substance;

                if (!this.microorganisms.has(microorganism)) {
                    this.microorganisms.set(microorganism, 0);
                }
                this.microorganisms.set(microorganism, this.microorganisms.get(microorganism) + 1);


                if (!this.compounds.has(compound)) {
                    this.compounds.set(compound, 0);
                }
                this.compounds.set(compound, this.compounds.get(compound) + 1);
/*

                if (!this.matrix.has(microorganism)) {
                    this.matrix.set(microorganism, new Map());
                }

                const matrix = this.matrix.get(microorganism);
                if (!matrix.has(compound)) {
                    matrix.set(compound, 0);
                }

                matrix.set(compound, matrix.get(compound) + 1);
*/
            }
        }
    }
}