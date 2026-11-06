import {pool} from '../src/db.js';
let ready=false;
for(let attempt=0;attempt<60;attempt++){
 try{await pool.query('SELECT 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}
}
await pool.end();if(!ready)throw Error('PostgreSQL did not become ready within 60 seconds.');console.log('PostgreSQL connection verified.');
