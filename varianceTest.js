import fs from 'fs';
import parse from 'csv-parse';

const { promises: { readFile } } = fs;


const parseCSV = async(blob) => {
    return await new Promise((resolve, reject) => {
        parse(blob.toString(), {
            columns: true,
        }, (err, records) => {
            if (err) reject(err);
            else resolve(records);
        });
    });
};
 


(async() => {
    const blob = await readFile('/home/ee/dev/infect/anresis-import-service/data/human.csv');
    const rows = await parseCSV(blob);
    const map = new Map();
    let i = 0;

    for (const row of rows) {
        for (const field of ['microorganism', 'substance', 'region', 'patient-sex']) {
            if (!map.has(row[field])) {
                map.set(row[field], new Set());
            }
            map.get(row[field]).add(i);

            let from = row['patient-age-range-from'];
            let to = row['patient-age-range-to'];

            for (;from < to; from++) {
                if (!map.has(`age-${from}`)) {
                    map.set(`age-${from}`, new Set());
                }
                map.get(`age-${from}`).add(i);
            }
        }
        i++;
    }

    const start = Date.now();

    const microorganism = map.get("'Streptococcus pneumoniae'");
    const substance = map.get('Penicillin');
    const region = map.get('Switzerland North-West');
    const sex = map.get('m');
    const ageMaps = [];


    for (let i = 50; i < 70; i++) {
        ageMaps.push(map.get(`age-${i}`));
    }
    //const results = [microorganism, substance, region, sex];

    //console.log('microorganism', microorganism.size);
    //results.sort((a, b) => a.size - b.size);
    for (const position of microorganism.values()) {
        if (!sex.has(position)) {
            microorganism.delete(position);
        }
    }
    //console.log('sex', microorganism.size);


    for (const position of microorganism.values()) {
        if (!substance.has(position)) {
            microorganism.delete(position);
        }
    }
    //console.log('substance', microorganism.size);

    for (const position of microorganism.values()) {
        if (!region.has(position)) {
            microorganism.delete(position);
        }
    }
    //console.log('region', microorganism.size);

   

    for (const position of microorganism.values()) {
        let isPartOfMap = false;

        for (const ageMap of ageMaps) {
            if (ageMap && ageMap.has(position)) {
                isPartOfMap = true;
                break;
            }
        }

        if (!isPartOfMap) {
            microorganism.delete(position);
        }
    }
    //console.log('age', microorganism.size);


    // get filtered rows
    const items = [];

    for (const index of microorganism.values()) {
        items.push(rows[index]);
    } 




    console.log('time', Date.now()-start);
    console.log(items.length);
})().then(() => {
    console.log('done');
}).catch(console.log);