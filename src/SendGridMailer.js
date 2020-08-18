import sendgridMailer from '@sendgrid/mail';
import logd from 'logd';

const log = logd.module('sendgrid-mailer');



export default class SendGridMailer {


    constructor({
        recipients,
        apiKey,
        from,
    }) {
        this.recipients = recipients;
        this.apiKey = apiKey;
        this.from = from;
    }



    async sendReport(report) {
        sendgridMailer.setApiKey(this.apiKey);

        for (const recipient of this.recipients) {
            const message = {
                to: recipient,
                from: this.from,
                subject: report.getSubjectLine(),
                html: report.getHTMLReport(),
                text: report.getHTMLReport(),
            };

            try {
                const result = await sendgridMailer.send(message);
            } catch (err) {
                log.error(`Failed to send report!`, err);
                log.info(`Response:\n${error.response.body}`);
            }
        }
    }
}